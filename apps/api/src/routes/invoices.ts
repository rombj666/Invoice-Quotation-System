import { assertQuotationEditable, QuotationReadOnlyError } from "../utils/quotation-edit-lock";
import { createHash, randomUUID } from "node:crypto";
import { CustomizationType, InvoiceItemType, InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { cloudinaryFolders, deleteCloudinaryImage, deleteCloudinaryPdf, uploadCloudinaryBuffer, uploadCloudinaryDataUrl, type CloudinaryUpload } from "../services/cloudinary.service";
import { calculatePricing, hasValidServiceDates } from "../utils/invoice-pricing";
import { CART_SELECTION_ERROR, hasCartAddonConflict } from "../utils/addons";
import { prisma } from "../utils/prisma";
import { toInvoicePayload } from "../utils/invoice-payload";
import { parseMultipartRequest } from "../utils/multipart";
import { sendNotification } from "../services/notifications";
import { assertValidInvoiceStatePair, canQuotationCreateInvoice, expireOverdueQuotations, isUniqueConflict } from "../utils/state-machine";

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
      const kind = fieldName === "customMenu" || fieldName === "latteArt" ? fieldName : fieldName.split(":")[0];
      return !allowedKinds.has(kind);
    });
    if (invalidField) return res.status(400).json({ error: "This customization type is not included in the confirmed invoice." });

    const invoiceFiles: Prisma.InvoiceFileCreateManyInput[] = [];
    const customizationFiles: Prisma.CustomizationFileCreateManyInput[] = [];
    const uploadId = randomUUID();
    for (const [fieldName, file] of filesByField) {
      const isMenu = fieldName === "customMenu";
      const isLatte = fieldName === "latteArt";
      const type: CustomizationType = fieldName.startsWith("cart:") ? "CART_DESIGN" : fieldName.startsWith("sleeve:") ? "CUP_SLEEVE" : "CUP_STICKER";
      const folder = isMenu ? cloudinaryFolders.invoices : isLatte ? cloudinaryFolders.cupStickers : type === "CART_DESIGN" ? cloudinaryFolders.cartDesigns : type === "CUP_SLEEVE" ? cloudinaryFolders.cupSleeves : cloudinaryFolders.cupStickers;
      const upload = await uploadCloudinaryBuffer(file, folder, `${invoice.invoiceNo}-${uploadId}-${fieldName.replace(/[^a-z0-9-]/gi, "-")}-${file.fileName}`);
      if (!upload) throw new Error("Unable to upload customization artwork.");
      uploads.push(upload);
      if (isMenu) {
        invoiceFiles.push({ invoiceId: invoice.id, fileUrl: upload.fileUrl, cloudinaryPublicId: upload.cloudinaryPublicId, fileName: file.fileName, mimeType: upload.mimeType });
      } else {
        customizationFiles.push({ invoiceId: invoice.id, type, designKey: isLatte ? "latte-art" : fieldName.split(":").slice(1).join(":"), fileUrl: upload.fileUrl, cloudinaryPublicId: upload.cloudinaryPublicId, fileName: file.fileName, mimeType: upload.mimeType, metadata: toJsonValue({ physicalSize: data.physicalSizes?.[fieldName] ?? null, originalArtwork: true }) });
      }
    }

    const setup = { acknowledgements: data.acknowledgements, artworkFiles: invoiceFiles.map((file) => ({ fileUrl: file.fileUrl, physicalSize: data.physicalSizes?.customMenu ?? null, kind: "customMenu" })), eventAddress: String(data.eventAddress ?? ""), dressCode: String(data.dressCode ?? ""), customDressCode: String(data.customDressCode ?? ""), environment: String(data.environment ?? ""), environmentNotes: String(data.environmentNotes ?? ""), submittedAt: new Date().toISOString() };
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

invoiceRoutes.post("/", async (req, res, next) => {
  try {
    const isMultipart = req.headers["content-type"]?.includes("multipart/form-data");
    const multipart = isMultipart ? await parseMultipartRequest(req) : null;
    const incomingData = multipart ? JSON.parse(multipart.fields.payload ?? "{}") : req.body;
    const data = incomingData;
    const filesByField = new Map((multipart?.files ?? []).map((file) => [file.fieldName, file]));
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: data.quotation.quotationNo },
      include: { customer: true, dates: true }
    });
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    await expireOverdueQuotations();
    const invoiceGuard = canQuotationCreateInvoice(quotation.status, quotation.expiresAt);
    if (!invoiceGuard.allowed) return res.status(409).json({ error: invoiceGuard.reason });
    const savedQuotation = quotation.metadata as any;
    if (!savedQuotation) return res.status(409).json({ error: "The saved quotation data is unavailable." });
    if (!hasValidServiceDates(savedQuotation.serviceDates)) {
      return res.status(409).json({ error: "The saved quotation has invalid service-date cup quantities." });
    }
    if (hasCartAddonConflict(savedQuotation.selectedAddons)) {
      return res.status(400).json({ error: CART_SELECTION_ERROR });
    }
    data.quotation = savedQuotation;
    // Idempotency: reject a resubmission that carries the same unique token.
    const submissionToken = String(data.submissionToken ?? "").trim() || undefined;
    if (submissionToken) {
      const duplicate = await prisma.invoice.findUnique({ where: { submissionToken }, select: { invoiceNo: true, status: true } });
      if (duplicate) {
        return res.status(409).json({ code: "ALREADY_SUBMITTED", error: "This invoice was already submitted.", invoiceNo: duplicate.invoiceNo });
      }
    }
    const existingInvoice = await prisma.invoice.findFirst({ where: { quotationId: quotation.id }, select: { invoiceNo: true, status: true } });
    if (existingInvoice) {
      return res.status(409).json({
        error: existingInvoice.status === "DRAFT" ? "An invoice draft already exists for this quotation." : "This quotation already has a submitted invoice.",
        access: existingInvoice.status === "DRAFT" ? "DRAFT_INVOICE" : "SUBMITTED_INVOICE",
        invoiceNo: existingInvoice.invoiceNo
      });
    }

    const pricing = calculatePricing(data.quotation);
    // Amount must match the system calculation. The client-generated PDF amount
    // is cross-checked here; mismatches are rejected instead of stored.
    const pdfAmount = Number(data.invoicePdfAmount ?? savedQuotation.pricingSnapshot?.total ?? 0);
    if (Number.isFinite(pdfAmount) && pdfAmount > 0 && Math.abs(pdfAmount - Number(pricing.total)) > 0.01) {
      return res.status(409).json({
        code: "AMOUNT_MISMATCH",
        error: "The amount on the invoice does not match the system price. Please refresh the page and resubmit.",
        systemTotal: pricing.total
      });
    }
    // Collision-safe numbering: skip any already-used invoice numbers.
    const usedInvoiceNos = new Set((await prisma.invoice.findMany({ select: { invoiceNo: true } })).map((invoice) => invoice.invoiceNo));
    const requestedInvoiceNo = String(data.invoiceNo ?? "").trim().toUpperCase();
    let invoiceNo: string;
    if (requestedInvoiceNo && !usedInvoiceNos.has(requestedInvoiceNo)) {
      invoiceNo = requestedInvoiceNo;
    } else if (requestedInvoiceNo && usedInvoiceNos.has(requestedInvoiceNo)) {
      return res.status(409).json({
        code: "INVOICE_NUMBER_CONFLICT",
        error: "The invoice number was just used. Retrying with the next available number.",
        nextInvoiceNo: await getNextAvailableInvoiceNo(usedInvoiceNos, requestedInvoiceNo)
      });
    } else {
      invoiceNo = await getNextAvailableInvoiceNo(usedInvoiceNos);
    }
    const invoicePdfFile = filesByField.get("invoicePdf");
    if (invoicePdfFile && invoicePdfFile.mimeType !== "application/pdf") {
      return res.status(400).json({ error: "The submitted invoice document must be a PDF." });
    }
    const receiptUpload = filesByField.has("receipt")
      ? await uploadCloudinaryBuffer(filesByField.get("receipt"), cloudinaryFolders.receipts, `${invoiceNo}-${data.receiptName || filesByField.get("receipt")?.fileName || "receipt"}`)
      : await uploadCloudinaryDataUrl(data.receiptDataUrl, cloudinaryFolders.receipts, `${invoiceNo}-${data.receiptName || "receipt"}`);
    const customMenuUpload = await uploadCloudinaryBuffer(filesByField.get("customMenuFile"), cloudinaryFolders.invoices, `${invoiceNo}-custom-menu-${data.customMenuFile?.fileName || filesByField.get("customMenuFile")?.fileName || "custom-menu"}`);
    const invoicePdfUpload = filesByField.has("invoicePdf")
      ? await uploadCloudinaryBuffer(invoicePdfFile, cloudinaryFolders.invoicePdfs, `${invoiceNo}-${Date.now()}.pdf`)
      : await uploadCloudinaryDataUrl(data.invoicePdfDataUrl, cloudinaryFolders.invoicePdfs, `${invoiceNo}-${Date.now()}.pdf`);

    const invoiceStatus = (data.invoiceStatus ?? "SUBMITTED") as InvoiceStatus;
    const paymentStatus = (receiptUpload ? "RECEIPT_UPLOADED" : "UNPAID") as PaymentStatus;
    const receiptAmount = Number(data.receiptAmount);
    const receiptAccount = String(data.receiptAccount ?? "").trim();
    const receiptBank = String(data.receiptBank ?? "").trim();
    const resolvedInvoiceStatus = invoiceStatus;
    const resolvedPaymentStatus = paymentStatus;
    try {
      assertValidInvoiceStatePair(resolvedInvoiceStatus, resolvedPaymentStatus);
    } catch (error) {
      return res.status(409).json({ error: error instanceof Error ? error.message : "Illegal invoice state combination." });
    }

    const invoice = await prisma.$transaction(async (tx) => {
    await assertQuotationEditable(tx, quotation.id);
    const createdInvoice = await tx.invoice.create({
      data: {
        invoiceNo,
        quotationId: quotation.id,
        customerId: quotation.customerId,
        submissionToken: submissionToken ?? null,
        status: resolvedInvoiceStatus,
        paymentStatus: resolvedPaymentStatus,
        eventAddress: data.eventAddress || null,
        dressCode: data.dressCode === "Custom" ? data.customDressCode || data.dressCode : data.dressCode || null,
        environmentNotes: [data.environment, data.environmentNotes].filter(Boolean).join(" - ") || null,
        finalSubtotalAmount: pricing.subtotal,
        finalDiscountAmount: pricing.discountAmount,
        finalTotalAmount: pricing.total,
        invoicePdfUrl: invoicePdfUpload?.fileUrl ?? null,
        invoicePdfPublicId: invoicePdfUpload?.cloudinaryPublicId ?? null,
        metadata: toJsonValue({
          ...data,
          invoiceNo,
          receiptDataUrl: undefined,
          customMenuFile: customMenuUpload
            ? {
                fileName: data.customMenuFile?.fileName || filesByField.get("customMenuFile")?.fileName || "custom-menu",
                fileUrl: customMenuUpload.fileUrl,
                mimeType: customMenuUpload.mimeType
              }
            : data.customMenuFile
        }),
        items: {
          create: [
            {
              itemType: "COFFEE_SERVICE" as InvoiceItemType,
              name: "Coffee Catering",
              description: "Americano, Cafe Latte, Dark Chocolate, Lemonade",
              quantity: 1,
              unitPrice: pricing.baseAmount,
              amount: pricing.baseAmount
            },
            ...(pricing.extraBaristaFee > 0
              ? [{
                  itemType: "EXTRA_BARISTA" as InvoiceItemType,
                  name: "Extra Barista",
                  description: "Extra barista fee based on service hours",
                  quantity: 1,
                  unitPrice: pricing.extraBaristaFee,
                  amount: pricing.extraBaristaFee
                }]
              : []),
            ...(pricing.totalExtraServingHourFee > 0
              ? [{
                  itemType: "EXTRA_SERVING_HOUR" as InvoiceItemType,
                  name: "Extra Serving Hour",
                  description: "Automatically calculated per service date below 100 cups",
                  quantity: 1,
                  unitPrice: pricing.totalExtraServingHourFee,
                  amount: pricing.totalExtraServingHourFee,
                  metadata: toJsonValue({ breakdown: pricing.extraServingHoursByDate })
                }]
              : []),
            ...(pricing.machineRentalFee > 0
              ? [{
                  itemType: "MACHINE_RENTAL" as InvoiceItemType,
                  name: "Machine Rental",
                  description: "Additional coffee machine rental",
                  quantity: 1,
                  unitPrice: pricing.machineRentalFee,
                  amount: pricing.machineRentalFee
                }]
              : []),
            ...(pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee > 0
              ? [{
                  itemType: "ADDON" as InvoiceItemType,
                  name: "Add-ons",
                  description: "Selected quotation add-ons",
                  quantity: 1,
                  unitPrice: pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee,
                  amount: pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee
                }]
              : [])
          ]
        },
        paymentReceipts: receiptUpload
          ? {
              create: {
                fileUrl: receiptUpload.fileUrl,
                cloudinaryPublicId: receiptUpload.cloudinaryPublicId,
                fileName: data.receiptName || "receipt",
                mimeType: receiptUpload.mimeType,
                status: "RECEIPT_UPLOADED",
                receiptAmount: Number.isFinite(receiptAmount) && receiptAmount > 0 ? receiptAmount : null,
                receiptAccount: receiptAccount || null,
                receiptBank: receiptBank || null,
                verificationStatus: null,
                verificationNote: null
              }
            }
          : undefined
      },
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true, internalNotes: { orderBy: { createdAt: "desc" } }, statusHistory: { orderBy: { createdAt: "desc" } } }
    });

    if (customMenuUpload) {
      await tx.invoiceFile.create({
        data: {
          invoiceId: createdInvoice.id,
          fileUrl: customMenuUpload.fileUrl,
          cloudinaryPublicId: customMenuUpload.cloudinaryPublicId,
          fileName: data.customMenuFile?.fileName || filesByField.get("customMenuFile")?.fileName || "custom-menu",
          mimeType: customMenuUpload.mimeType
        }
      });
    }

    const designGroups: Array<{ type: CustomizationType; folder: string; designs: Record<string, any> | undefined }> = [
      { type: "CART_DESIGN", folder: cloudinaryFolders.cartDesigns, designs: data.cartDesigns },
      { type: "CUP_STICKER", folder: cloudinaryFolders.cupStickers, designs: data.stickerDesigns },
      { type: "CUP_SLEEVE", folder: cloudinaryFolders.cupSleeves, designs: data.sleeveDesigns }
    ];

    for (const group of designGroups) {
      for (const [designKey, design] of Object.entries(group.designs ?? {})) {
        const formField =
          group.type === "CART_DESIGN"
            ? `cartDesigns:${designKey}`
            : group.type === "CUP_STICKER"
              ? `stickerDesigns:${designKey}`
              : `sleeveDesigns:${designKey}`;
        const upload = filesByField.has(formField)
          ? await uploadCloudinaryBuffer(filesByField.get(formField), group.folder, `${invoiceNo}-${group.type}-${designKey}-${design?.fileName || filesByField.get(formField)?.fileName || "design"}`)
          : await uploadCloudinaryDataUrl(design?.dataUrl, group.folder, `${invoiceNo}-${group.type}-${designKey}-${design?.fileName || "design"}`);
        if (!upload) continue;
        await tx.customizationFile.create({
          data: {
            invoiceId: createdInvoice.id,
            type: group.type,
            designKey,
            fileUrl: upload.fileUrl,
            cloudinaryPublicId: upload.cloudinaryPublicId,
            fileName: design.fileName || "design",
            mimeType: upload.mimeType,
            metadata: toJsonValue({ ...design, dataUrl: undefined })
          }
        });
      }
    }

    // Linkage: once the invoice is created, the source quotation is locked to
    // CONVERTED_TO_INVOICE so it can no longer be edited or re-invoiced.
    await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        status: "CONVERTED_TO_INVOICE",
        statusHistory: {
          create: {
            fromStatus: quotation.status,
            toStatus: "CONVERTED_TO_INVOICE",
            changedBy: "system",
            changeSummary: `Invoice ${invoiceNo} created. Quotation is now locked.`
          }
        }
      }
    });
    return createdInvoice;
    });

    // Notifications for the submitted invoice and its receipt.
    const invoiceLink = `/customer/invoice?no=${encodeURIComponent(invoiceNo)}`;
    const adminInvoiceLink = `/admin/invoices?no=${encodeURIComponent(invoiceNo)}`;
    const customerContact = {
      name: quotation.customer.name,
      phone: quotation.customer.phone,
      email: quotation.customer.email
    };
    await sendNotification({
      type: "INVOICE_SUBMITTED",
      recipient: { role: "admin", name: "Hour Coffee Admin" },
      title: `New invoice ${invoiceNo}`,
      message: `${quotation.customer.name} submitted invoice ${invoiceNo} (RM ${Number(pricing.total).toFixed(2)}).`,
      referenceNo: invoiceNo,
      link: adminInvoiceLink
    });
    await sendNotification({
      type: "INVOICE_SUBMITTED",
      recipient: { role: "customer", ...customerContact },
      title: `Invoice ${invoiceNo} submitted`,
      message: `Your invoice ${invoiceNo} was received. Total: RM ${Number(pricing.total).toFixed(2)}.`,
      referenceNo: invoiceNo,
      link: invoiceLink
    });
    const saved = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true }
    });
    res.status(201).json(toInvoicePayload(saved));
  } catch (error) {
    if (error instanceof QuotationReadOnlyError) return res.status(409).json({ error: error.message });
    if (isUniqueConflict(error, "invoiceNo")) {
      const used = new Set((await prisma.invoice.findMany({ select: { invoiceNo: true } })).map((invoice) => invoice.invoiceNo));
      return res.status(409).json({
        code: "INVOICE_NUMBER_CONFLICT",
        error: "The invoice number was just used. Retrying with the next available number.",
        nextInvoiceNo: await getNextAvailableInvoiceNo(used)
      });
    }
    if (isUniqueConflict(error, "submissionToken")) {
      return res.status(409).json({ code: "ALREADY_SUBMITTED", error: "This invoice was already submitted." });
    }
    next(error);
  }
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
