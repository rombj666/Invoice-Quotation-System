import { createHash } from "node:crypto";
import { Router } from "express";
import { cloudinaryFolders, uploadCloudinaryBuffer } from "../services/cloudinary.service";
import { toInvoicePayload } from "../utils/invoice-payload";
import { parseMultipartRequest } from "../utils/multipart";
import { prisma } from "../utils/prisma";
import { getPortalStage } from "../utils/portal-stage";
import { toQuotationPayload } from "./quotations";

export const portalRoutes = Router();

async function resolvePortal(token: string) {
  const quotations = await prisma.quotation.findMany({
    include: {
      customer: true,
      dates: { orderBy: { serviceDate: "asc" }, include: { drinks: true } },
      extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" }, take: 1, include: { paymentReceipts: { orderBy: { uploadedAt: "desc" } }, customizationFiles: true, invoiceFiles: true, drinkSnapshots: { orderBy: { serviceDate: "asc" } } } }
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

portalRoutes.post("/:token/receipt", async (req, res, next) => {
  try {
    const record = await resolvePortal(req.params.token);
    const invoice = record?.invoices[0];
    if (!record || !invoice) return res.status(404).json({ error: "This link is invalid or no longer available." });
    if (invoice.paymentStatus === "VERIFIED") return res.status(409).json({ error: "Payment has already been verified." });
    if (invoice.paymentStatus === "RECEIPT_UPLOADED") return res.status(409).json({ error: "A receipt has already been submitted and is waiting for verification." });
    const multipart = await parseMultipartRequest(req, 15 * 1024 * 1024);
    const file = multipart.files.find((item) => item.fieldName === "receipt");
    if (!file) return res.status(400).json({ error: "Choose a payment receipt to upload." });
    if (file.mimeType !== "application/pdf" && !file.mimeType.startsWith("image/")) return res.status(400).json({ error: "Payment receipts must be a PDF or image." });
    const upload = await uploadCloudinaryBuffer(file, cloudinaryFolders.receipts, `${invoice.invoiceNo}-${Date.now()}-${file.fileName}`);
    if (!upload) throw new Error("Unable to upload payment receipt.");
    await prisma.$transaction([
      prisma.paymentReceipt.create({ data: { invoiceId: invoice.id, fileUrl: upload.fileUrl, cloudinaryPublicId: upload.cloudinaryPublicId, fileName: file.fileName, mimeType: upload.mimeType, status: "RECEIPT_UPLOADED" } }),
      prisma.invoice.update({ where: { id: invoice.id }, data: { paymentStatus: "RECEIPT_UPLOADED" } })
    ]);
    res.status(201).json({ paymentStatus: "RECEIPT_UPLOADED" });
  } catch (error) { next(error); }
});
