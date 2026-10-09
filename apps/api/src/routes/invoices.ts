import { assertQuotationEditable, QuotationReadOnlyError } from "../utils/quotation-edit-lock";
import { createHash, randomUUID } from "node:crypto";
import { CustomizationType, Prisma } from "@prisma/client";
import { Router } from "express";
import { cloudinaryFolders, deleteCloudinaryImage, deleteCloudinaryPdf, uploadCloudinaryBuffer, type CloudinaryUpload } from "../services/cloudinary.service";
import { prisma } from "../utils/prisma";
import { toInvoicePayload } from "../utils/invoice-payload";
import { parseMultipartRequest } from "../utils/multipart";
import { isUniqueConflict } from "../utils/state-machine";

import { finalizeCustomization, FinalSubmissionError, FINAL_SUBMIT_DATE_ERROR } from "../services/finalize-customization";

export const invoiceRoutes = Router();

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function getNextAvailableInvoiceNo(used: Set<string>, fromNo?: string): Promise<string> {
  let index = fromNo ? (Number(fromNo.replace(/^A/i, "").replace(/^0+/, "")) || 1) : used.size + 1;
  let candidate = `A${String(index).padStart(5, "0")}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `A${String(index).padStart(5, "0")}`;
  }
  return candidate;
}

async function invoiceForCustomizationToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const paid = await prisma.invoice.findMany({
    where: { paymentStatus: { in: ["RECEIPT_UPLOADED", "VERIFIED"] }, status: { not: "CANCELLED" } },
    include: { quotation: true, paymentReceipts: true, customizationFiles: true, invoiceFiles: true }
  });
  return paid.find((invoice) => (invoice.quotation.metadata as any)?.portalToken === token || (invoice.metadata as any)?.customizationAccess?.tokenHash === tokenHash) ?? null;
}

function customizationKinds(quotation: any) {
  const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  const features = [...(quotation.packageSnapshot?.perks ?? []).map((item: any) => item.name), ...(quotation.selectedAddons ?? []).map((item: any) => item.name)].map(normalize);
  const includes = (...names: string[]) => features.some((feature) => names.some((name) => feature.includes(name)));
  return new Set([
    ...((quotation.cartStyle && quotation.cartStyle !== "NO_CART") || includes("coffee cart", "branded cart", "display cart") ? ["cart"] : []),
    ...(quotation.hasCupSleeves || quotation.selectedOptions?.includes("CUP_SLEEVES") || includes("cup sleeve") ? ["sleeve"] : []),
    ...(quotation.hasCupStickers || includes("cup sticker") ? ["sticker"] : []),
    ...(quotation.selectedOptions?.includes("FOAM_BOARD_STAND") || includes("foam board stand") ? ["foamBoard"] : []),
    ...(includes("custom menu") ? ["customMenu"] : []),
    ...(quotation.selectedOptions?.includes("LATTE_ART") || includes("latte art", "print pen", "special print") ? ["latteArt"] : [])
  ]);
}

invoiceRoutes.get("/customization/:token", async (req, res, next) => {
  try {
    const invoice = await invoiceForCustomizationToken(req.params.token);
    if (!invoice) return res.status(404).json({ error: "This customization link is invalid or a payment receipt has not been uploaded." });
    const payload = toInvoicePayload(invoice);
    delete payload.customizationAccess;
    res.json(payload);
  } catch (error) { next(error); }
});

invoiceRoutes.post("/customization/:token", async (req, res, next) => {
  const uploads: CloudinaryUpload[] = [];
  let committed = false;
  try {
    const invoice = await invoiceForCustomizationToken(req.params.token);
    if (!invoice) return res.status(404).json({ error: "This customization link is invalid or a payment receipt has not been uploaded." });
    if ((invoice.metadata as any)?.customizationSubmission?.submittedAt) return res.json({ ok: true, invoiceNo: invoice.invoiceNo });
    const multipart = await parseMultipartRequest(req, 40 * 1024 * 1024);
    const data = JSON.parse(multipart.fields.payload ?? "{}");
    if (!Array.isArray(data.acknowledgements) || data.acknowledgements.length !== 5 || !data.acknowledgements.every((value: unknown) => value === true)) return res.status(400).json({ error: "Complete all required acknowledgements before submitting." });
    const metadata = (invoice.metadata ?? {}) as any;
    const allowedKinds = customizationKinds(metadata.quotation ?? {});
    const filesByField = new Map(multipart.files.map((file) => [file.fieldName, file]));
    const invalidField = [...filesByField.keys()].find((fieldName) => {
      const kind = fieldName === "customMenu" ? fieldName : fieldName.split(":")[0];
      return !allowedKinds.has(kind);
    });
    if (invalidField) return res.status(400).json({ error: "This customization type is not included in the confirmed invoice." });

    const invoiceFiles: Prisma.InvoiceFileCreateManyInput[] = [];
    const invoiceFileMetadata: Array<Record<string, unknown>> = [];
    const customizationFiles: Prisma.CustomizationFileCreateManyInput[] = [];
    const uploadId = randomUUID();
    for (const [fieldName, file] of filesByField) {
      const isMenu = fieldName === "customMenu";
      const isLatte = fieldName === "latteArt" || fieldName.startsWith("latteArt:");
      const isFoamBoard = fieldName.startsWith("foamBoard:");
      const isFinal = fieldName.includes(":final") || fieldName.endsWith(":final");
      const type: CustomizationType = fieldName.startsWith("cart:") ? "CART_DESIGN" : fieldName.startsWith("sleeve:") ? "CUP_SLEEVE" : "CUP_STICKER";
      const folder = isMenu || isFoamBoard ? cloudinaryFolders.invoices : isLatte ? cloudinaryFolders.cupStickers : type === "CART_DESIGN" ? cloudinaryFolders.cartDesigns : type === "CUP_SLEEVE" ? cloudinaryFolders.cupSleeves : cloudinaryFolders.cupStickers;
      const upload = await uploadCloudinaryBuffer(file, folder, `${invoice.invoiceNo}-${uploadId}-${fieldName.replace(/[^a-z0-9-]/gi, "-")}-${file.fileName}`);
      if (!upload) throw new Error("Unable to upload customization artwork.");
      uploads.push(upload);
      if (isMenu || isFoamBoard) {
        invoiceFiles.push({ invoiceId: invoice.id, fileUrl: upload.fileUrl, cloudinaryPublicId: upload.cloudinaryPublicId, fileName: file.fileName, mimeType: upload.mimeType });
        invoiceFileMetadata.push({
          fileUrl: upload.fileUrl,
          physicalSize: data.physicalSizes?.[fieldName] ?? (isMenu ? data.physicalSizes?.customMenu : null),
          kind: isFoamBoard ? "foamBoard" : "customMenu",
          finalDesign: isFinal,
          originalArtwork: !isFinal,
          designKey: isFoamBoard ? fieldName.split(":").slice(2).join(":") : "customMenu",
          geometry: data.designMetadata?.[fieldName] ?? null
        });
      } else {
        const parts = fieldName.split(":");
        const designKey = isLatte ? "latte-art" : parts[1] === "final" ? (type === "CUP_STICKER" ? `${parts[2]}:${parts[3] ?? ""}` : parts[2]) : parts.slice(1).join(":");
        customizationFiles.push({ invoiceId: invoice.id, type, designKey, fileUrl: upload.fileUrl, cloudinaryPublicId: upload.cloudinaryPublicId, fileName: file.fileName, mimeType: upload.mimeType, metadata: toJsonValue({ physicalSize: data.physicalSizes?.[fieldName] ?? null, originalArtwork: !isFinal, finalDesign: isFinal, geometry: data.designMetadata?.[fieldName] ?? null }) });
      }
    }

    const setup = { acknowledgements: data.acknowledgements, artworkFiles: invoiceFileMetadata, eventAddress: String(data.eventAddress ?? ""), dressCode: String(data.dressCode ?? ""), customDressCode: String(data.customDressCode ?? ""), environment: String(data.environment ?? ""), environmentNotes: String(data.environmentNotes ?? ""), submittedAt: new Date().toISOString() };
    committed = await prisma.$transaction((tx) => finalizeCustomization(tx, invoice.id, setup, invoiceFiles, customizationFiles));
    res.json({ ok: true, invoiceNo: invoice.invoiceNo });
  } catch (error) {
    if (error instanceof FinalSubmissionError || isUniqueConflict(error, "date")) {
      return res.status(409).json({ error: error instanceof FinalSubmissionError ? error.message : FINAL_SUBMIT_DATE_ERROR });
    }
    next(error);
  } finally {
    if (!committed) await Promise.allSettled(uploads.map((upload) => upload.mimeType === "application/pdf" ? deleteCloudinaryPdf(upload.cloudinaryPublicId) : deleteCloudinaryImage(upload.cloudinaryPublicId)));
  }
});

invoiceRoutes.get("/next-number", async (_req, res, next) => {
  try {
    const used = new Set((await prisma.invoice.findMany({ select: { invoiceNo: true } })).map((invoice) => invoice.invoiceNo));
    res.json({ invoiceNo: await getNextAvailableInvoiceNo(used) });
  } catch (error) {
    next(error);
  }
});

invoiceRoutes.post("/", (_req, res) => {
  res.status(410).json({ error: "Invoice generation is handled by Hour Coffee after quotation review." });
});

invoiceRoutes.get("/", async (_req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true }
    });
    res.json(invoices.map(toInvoicePayload));
  } catch (error) {
    next(error);
  }
});

invoiceRoutes.get("/:invoiceNo", async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNo: req.params.invoiceNo },
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true, internalNotes: { orderBy: { createdAt: "desc" } }, statusHistory: { orderBy: { createdAt: "desc" } } }
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(toInvoicePayload(invoice));
  } catch (error) {
    next(error);
  }
});
