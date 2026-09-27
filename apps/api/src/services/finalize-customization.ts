import { Prisma } from "@prisma/client";

export const FINAL_SUBMIT_DATE_ERROR = "This event date is no longer available. Please contact Hour Coffee to update your event date.";

export class FinalSubmissionError extends Error {}

export async function finalizeCustomization(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  setup: Record<string, string>,
  invoiceFiles: Prisma.InvoiceFileCreateManyInput[],
  customizationFiles: Prisma.CustomizationFileCreateManyInput[]
) {
  // Serialize retries for the same invoice and read the latest confirmed dates/status.
  await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
  const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (invoice.paymentStatus !== "VERIFIED" || invoice.status === "CANCELLED") {
    throw new FinalSubmissionError("Payment must be verified before completing customization.");
  }
  const metadata = (invoice.metadata ?? {}) as Record<string, any>;
  if (metadata.customizationSubmission?.submittedAt) return false;
  const serviceDates = metadata.quotation?.serviceDates;
  if (!Array.isArray(serviceDates) || !serviceDates.length) {
    throw new FinalSubmissionError("The invoice has no valid event dates. Please contact Hour Coffee.");
  }
  const dates = [...new Set<string>(serviceDates.map((item: any) => item.serviceDate))].sort().map((value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new FinalSubmissionError("The invoice has an invalid event date. Please contact Hour Coffee.");
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new FinalSubmissionError("The invoice has an invalid event date. Please contact Hour Coffee.");
    }
    return date;
  });
  if (await tx.lockedDate.findFirst({ where: { date: { in: dates } }, select: { id: true } })) {
    throw new FinalSubmissionError(FINAL_SUBMIT_DATE_ERROR);
  }
  // Never skip duplicates: LockedDate.date uniqueness arbitrates concurrent customers/manual locks.
  await tx.lockedDate.createMany({ data: dates.map((date) => ({
    date, customerName: metadata.quotation?.customer?.name || null,
    reference: invoice.invoiceNo, note: "Automatically locked on final customization submission."
  })) });
  if (invoiceFiles.length) await tx.invoiceFile.createMany({ data: invoiceFiles });
  if (customizationFiles.length) await tx.customizationFile.createMany({ data: customizationFiles });
  await tx.invoice.update({ where: { id: invoiceId }, data: {
    metadata: JSON.parse(JSON.stringify({ ...metadata, customizationSubmission: { ...setup, submittedAt: new Date().toISOString() } })) as Prisma.InputJsonValue
  } });
  return true;
}
