import { createHash } from "node:crypto";
import { Router } from "express";
import { toInvoicePayload } from "../utils/invoice-payload";
import { prisma } from "../utils/prisma";
import { getPortalStage } from "../utils/portal-stage";
import { toQuotationPayload } from "./quotations";

export const portalRoutes = Router();

async function resolvePortal(token: string) {
  const quotations = await prisma.quotation.findMany({
    include: {
      customer: true,
      dates: { orderBy: { serviceDate: "asc" } },
      extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" }, take: 1, include: { paymentReceipts: { orderBy: { uploadedAt: "desc" } }, customizationFiles: true, invoiceFiles: true } }
    }
  });
  const direct = quotations.find((quotation) => (quotation.metadata as any)?.portalToken === token);
  if (direct) return direct;
  const legacyHash = createHash("sha256").update(token).digest("hex");
  return quotations.find((quotation) => (quotation.invoices[0]?.metadata as any)?.customizationAccess?.tokenHash === legacyHash) ?? null;
}

portalRoutes.get("/:token", async (req, res, next) => {
  try {
    const record = await resolvePortal(req.params.token);
    if (!record) return res.status(404).json({ error: "This link is invalid or no longer available." });
    const quotation = toQuotationPayload(record) as any;
    delete quotation.portalToken;
    const invoiceRecord = record.invoices[0];
    const invoice = invoiceRecord ? toInvoicePayload(invoiceRecord) : null;
    if (invoice) delete invoice.customizationAccess;
    const stage = getPortalStage(invoice);
    res.json({ stage, quotation, invoice });
  } catch (error) { next(error); }
});
