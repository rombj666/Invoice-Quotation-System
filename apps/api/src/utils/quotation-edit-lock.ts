import type { Prisma } from "@prisma/client";

export class QuotationReadOnlyError extends Error {
  constructor(message = "This quotation has an invoice and is read-only.") { super(message); }
}

/** Serialize invoice creation and quotation mutations, then inspect the current relation. */
export async function assertQuotationEditable(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Quotation" WHERE "id" = ${id} FOR UPDATE`;
  const current = await tx.quotation.findUniqueOrThrow({ where: { id }, include: { invoices: { select: { id: true }, take: 1 } } });
  if (current.status !== "PENDING_APPROVAL" || current.invoices.length) throw new QuotationReadOnlyError();
  return current;
}
