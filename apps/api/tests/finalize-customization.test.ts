import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { finalizeCustomization, FINAL_SUBMIT_DATE_ERROR } from "../src/services/finalize-customization";

// In-memory transaction harness: commits enforce the same unique date contract,
// while pending writes disappear on failure. No production database is accessed.
function database() {
  const locks = new Map<string, string>();
  const completed = new Map<string, any>();
  const quotationStatuses = new Map<string, string>();
  const files: any[] = [];
  let failCompletion = false;
  let checks = 0;
  let release: (() => void) | undefined;
  const bothChecked = new Promise<void>((resolve) => { release = resolve; });
  async function submit(id: string, dates: string[], options: { race?: boolean; status?: string; payment?: string } = {}) {
    const pendingLocks: any[] = [];
    const pendingFiles: any[] = [];
    let pendingMetadata: any;
    let pendingQuotationStatus: string | undefined;
    const tx = {
      $queryRaw: async () => [{ id }],
      invoice: {
        findUniqueOrThrow: async () => ({ id, invoiceNo: id, quotationId: id, status: options.status ?? "SUBMITTED", paymentStatus: options.payment ?? "VERIFIED", metadata: completed.get(id) ?? { quotation: { customer: { name: id }, serviceDates: dates.map((serviceDate) => ({ serviceDate })) } } }),
        update: async ({ data }: any) => { if (failCompletion) throw new Error("Completion write failed"); pendingMetadata = data.metadata; }
      },
      quotation: {
        findUniqueOrThrow: async () => ({ id, status: quotationStatuses.get(id) ?? "GENERATED_INVOICE" }),
        update: async ({ data }: any) => { pendingQuotationStatus = data.status; }
      },
      lockedDate: {
        findFirst: async ({ where }: any) => {
          const locked = where.date.in.some((date: Date) => locks.has(date.toISOString()));
          if (options.race) { checks += 1; if (checks === 2) release!(); await bothChecked; }
          return locked ? { id: "existing-lock" } : null;
        },
        createMany: async ({ data }: any) => { pendingLocks.push(...data); }
      },
      invoiceFile: { createMany: async ({ data }: any) => { pendingFiles.push(...data); } },
      customizationFile: { createMany: async ({ data }: any) => { pendingFiles.push(...data); } }
    } as unknown as Prisma.TransactionClient;
    const result = await finalizeCustomization(tx, id, { eventAddress: "Venue" }, [{ invoiceId: id, fileUrl: "https://example.com/menu.pdf", fileName: "menu.pdf" }], []);
    if (pendingLocks.some((lock) => locks.has(lock.date.toISOString()))) {
      throw new Prisma.PrismaClientKnownRequestError("Unique date conflict", { code: "P2002", clientVersion: "test", meta: { target: ["date"] } });
    }
    pendingLocks.forEach((lock) => locks.set(lock.date.toISOString(), id));
    files.push(...pendingFiles);
    if (pendingMetadata) completed.set(id, pendingMetadata);
    if (pendingQuotationStatus) quotationStatuses.set(id, pendingQuotationStatus);
    return result;
  }
  return { locks, completed, quotationStatuses, files, submit, failCompletion: () => { failCompletion = true; } };
}

test("final submit locks all unique confirmed dates and completes with files", async () => {
  const db = database();
  assert.equal(await db.submit("A00001", ["2026-10-29", "2026-10-28", "2026-10-28"]), true);
  assert.deepEqual([...db.locks.keys()], ["2026-10-28T00:00:00.000Z", "2026-10-29T00:00:00.000Z"]);
  assert.ok(db.completed.get("A00001").customizationSubmission.submittedAt);
  assert.equal(db.quotationStatuses.get("A00001"), "COMPLETED");
  assert.equal(db.files.length, 1);
});

test("an existing manual or customer lock rejects all dates without partial completion", async () => {
  const db = database();
  db.locks.set("2026-10-29T00:00:00.000Z", "manual");
  await assert.rejects(db.submit("A00001", ["2026-10-28", "2026-10-29"]), { message: FINAL_SUBMIT_DATE_ERROR });
  assert.equal(db.locks.size, 1);
  assert.equal(db.completed.size, 0);
  assert.equal(db.files.length, 0);
});

test("two customers passing availability simultaneously have only one successful commit", async () => {
  const db = database();
  const results = await Promise.allSettled([
    db.submit("A00001", ["2026-10-28"], { race: true }),
    db.submit("A00002", ["2026-10-28", "2026-10-29"], { race: true })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
  assert.equal(rejected.reason.code, "P2002");
  assert.equal(db.completed.size, 1);
  assert.equal(db.files.length, 1);
  const winner = [...db.completed.keys()][0];
  assert.ok([...db.locks.values()].every((owner) => owner === winner));
});

test("completion failure rolls back pending date locks and files", async () => {
  const db = database();
  db.failCompletion();
  await assert.rejects(db.submit("A00001", ["2026-10-28"]), /Completion write failed/);
  assert.equal(db.locks.size, 0);
  assert.equal(db.completed.size, 0);
  assert.equal(db.files.length, 0);
});

test("retrying a completed invoice is idempotent", async () => {
  const db = database();
  await db.submit("A00001", ["2026-10-28"]);
  assert.equal(await db.submit("A00001", ["2026-10-28"]), false);
  assert.equal(db.locks.size, 1);
  assert.equal(db.files.length, 1);
});

test("invalid dates, unverified payments and cancelled invoices cannot lock dates", async () => {
  const db = database();
  await assert.rejects(db.submit("A00001", ["2026-02-30"]), /invalid event date/);
  await assert.rejects(db.submit("A00001", []), /no valid event dates/);
  await assert.rejects(db.submit("A00001", ["2026-10-28"], { payment: "RECEIPT_UPLOADED" }), /Payment must be verified/);
  await assert.rejects(db.submit("A00001", ["2026-10-28"], { status: "CANCELLED" }), /Payment must be verified/);
  assert.equal(db.locks.size, 0);
});
