import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { toQuotationPayload } from "../src/routes/quotations";
import { toInvoicePayload } from "../src/utils/invoice-payload";

const root = resolve(process.cwd(), "../..");
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("document payloads retain beverage metadata without relational hydration", () => {
  const metadata = {
    portalToken: "private-token",
    serviceDates: [{ id: "date-1", serviceDate: "2026-10-01" }],
    beverageSnapshots: { coffee: { id: "coffee", name: "Coffee" } },
    drinkOrders: { "date-1": { coffee: { ice: 0, hot: 0 } } },
    drinkDistributionModeByDate: { "date-1": "HOUR_COFFEE_DECIDES" },
    excludedBeverageIdsByDate: { "date-1": [] }
  };
  const quotation = toQuotationPayload({ metadata, quotationNo: "Q00001" });
  assert.deepEqual(quotation.beverageSnapshots, metadata.beverageSnapshots);
  assert.deepEqual(quotation.drinkOrders, metadata.drinkOrders);
  assert.deepEqual(quotation.excludedBeverageIdsByDate, metadata.excludedBeverageIdsByDate);
  assert.equal("portalToken" in quotation, false);
  assert.deepEqual(toInvoicePayload({ metadata: { quotation } }).quotation, quotation);
});

test("follow-up fields, routes, and frontend page are removed while operational statuses remain", () => {
  const schema = read("prisma", "schema.prisma");
  const adminRoutes = read("apps", "api", "src", "routes", "admin-records.ts");
  const quotationTypes = read("apps", "web", "types", "quotation.ts");
  assert.doesNotMatch(schema, /FollowUpStatus|followUpStatus|followUpNote|lastFollowedUpAt/);
  assert.doesNotMatch(adminRoutes, /follow.?up/i);
  assert.doesNotMatch(quotationTypes, /follow.?up/i);
  assert.equal(existsSync(join(root, "apps", "web", "app", "quotation", "contacted", "page.tsx")), false);
  assert.match(schema, /PENDING_APPROVAL/);
  assert.match(schema, /enum InvoiceStatus/);
  assert.match(schema, /enum PaymentStatus/);
});

test("public beverage filtering uses the current catalog", () => {
  const beverages = read("apps", "api", "src", "routes", "beverages.ts");
  assert.match(beverages, /where: \{ isAvailable: true, isArchived: false \}/);
});

test("invoice creation ignores browser quotation data and uses the saved quotation", () => {
  const invoices = read("apps", "api", "src", "routes", "invoices.ts");
  assert.match(invoices, /data\.quotation = savedQuotation/);
  assert.match(invoices, /itemType: "EXTRA_SERVING_HOUR"/);
});

test("quotation numbers use the highest numeric suffix and the plan step can navigate back", () => {
  const quotations = read("apps", "api", "src", "routes", "quotations.ts");
  const planEvent = read("apps", "web", "components", "quotation", "PlanEventStep.tsx");
  const quotationShell = read("apps", "web", "components", "quotation", "QuotationShell.tsx");
  assert.match(quotations, /MAX\(SUBSTRING\("quotationNo" FROM 2\)::INTEGER\)/);
  assert.match(quotations, /WHERE "quotationNo" ~ '\^Q\[0-9\]\{5\}\$'/);
  assert.match(quotations, /requestedQuotationNo !== quotationNo/);
  assert.match(quotations, /QUOTATION_NUMBER_CONFLICT/);
  assert.match(planEvent, /<StepNavigation canGoBack=\{Boolean\(onBack\)\} onBack=\{onBack\} onNext=\{onNext\} \/>/);
  assert.match(quotationShell, /<PlanEventStep[^>]+onBack=\{back\}/);
});
