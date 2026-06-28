import { CustomizationType, InvoiceItemType, InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { cloudinary, cloudinaryFolders } from "../services/cloudinary.service";
import { calculatePricing } from "../utils/pricing";
import { prisma } from "../utils/prisma";

export const invoiceRoutes = Router();

async function uploadDataUrl(dataUrl: string | undefined, folder: string, fileName: string) {
  if (!dataUrl) return null;
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder,
    resource_type: "auto",
    public_id: fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-")
  });
  return {
    fileUrl: result.secure_url,
    cloudinaryPublicId: result.public_id,
    mimeType: dataUrl.slice(5, dataUrl.indexOf(";")) || "application/octet-stream"
  };
}

function toInvoicePayload(record: any) {
  return {
    ...record.metadata,
    invoiceStatus: record.status,
    paymentStatus: record.paymentStatus,
    receiptUrl: record.paymentReceipts?.[0]?.fileUrl,
    customizationUrls: record.customizationFiles?.map((file: any) => ({
      type: file.type,
      designKey: file.designKey,
      fileUrl: file.fileUrl,
      fileName: file.fileName,
      metadata: file.metadata
    })) ?? []
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

invoiceRoutes.get("/next-number", async (_req, res, next) => {
  try {
    const count = await prisma.invoice.count();
    res.json({ invoiceNo: `A${String(count + 1).padStart(5, "0")}` });
  } catch (error) {
    next(error);
  }
});

invoiceRoutes.post("/", async (req, res, next) => {
  try {
    const data = req.body;
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: data.quotation.quotationNo },
      include: { customer: true, dates: true }
    });
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    if (quotation.status !== "APPROVED") return res.status(403).json({ error: "Quotation is still pending approval" });

    const pricing = calculatePricing(data.quotation);
    const invoiceNo = data.invoiceNo || `A${String((await prisma.invoice.count()) + 1).padStart(5, "0")}`;
    const receiptUpload = await uploadDataUrl(data.receiptDataUrl, cloudinaryFolders.receipts, `${invoiceNo}-${data.receiptName || "receipt"}`);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNo,
        quotationId: quotation.id,
        customerId: quotation.customerId,
        status: (data.invoiceStatus ?? "SUBMITTED") as InvoiceStatus,
        paymentStatus: (receiptUpload ? "RECEIPT_UPLOADED" : "UNPAID") as PaymentStatus,
        eventAddress: data.eventAddress || null,
        dressCode: data.dressCode === "Custom" ? data.customDressCode || data.dressCode : data.dressCode || null,
        environmentNotes: [data.environment, data.environmentNotes].filter(Boolean).join(" - ") || null,
        finalSubtotalAmount: pricing.subtotal,
        finalDiscountAmount: pricing.discountAmount,
        finalTotalAmount: pricing.total,
        metadata: toJsonValue({ ...data, invoiceNo, receiptDataUrl: undefined }),
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
            ...(pricing.setupFee > 0
              ? [{
                  itemType: "SETUP_FEE" as InvoiceItemType,
                  name: "Setup Fee",
                  description: "Service date setup fee",
                  quantity: 1,
                  unitPrice: pricing.setupFee,
                  amount: pricing.setupFee
                }]
              : []),
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
                status: "RECEIPT_UPLOADED"
              }
            }
          : undefined
      },
      include: { paymentReceipts: true, customizationFiles: true }
    });

    const designGroups: Array<{ type: CustomizationType; folder: string; designs: Record<string, any> | undefined }> = [
      { type: "CART_DESIGN", folder: cloudinaryFolders.cartDesigns, designs: data.cartDesigns },
      { type: "CUP_STICKER", folder: cloudinaryFolders.cupStickers, designs: data.stickerDesigns },
      { type: "CUP_SLEEVE", folder: cloudinaryFolders.cupSleeves, designs: data.sleeveDesigns }
    ];

    for (const group of designGroups) {
      for (const [designKey, design] of Object.entries(group.designs ?? {})) {
        if (!design?.dataUrl) continue;
        const upload = await uploadDataUrl(design.dataUrl, group.folder, `${invoiceNo}-${group.type}-${designKey}-${design.fileName || "design"}`);
        if (!upload) continue;
        await prisma.customizationFile.create({
          data: {
            invoiceId: invoice.id,
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

    const saved = await prisma.invoice.findUnique({
      where: { invoiceNo },
      include: { paymentReceipts: true, customizationFiles: true }
    });
    res.status(201).json(toInvoicePayload(saved));
  } catch (error) {
    next(error);
  }
});

invoiceRoutes.get("/", async (_req, res, next) => {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { paymentReceipts: true, customizationFiles: true }
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
      include: { paymentReceipts: true, customizationFiles: true }
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(toInvoicePayload(invoice));
  } catch (error) {
    next(error);
  }
});
