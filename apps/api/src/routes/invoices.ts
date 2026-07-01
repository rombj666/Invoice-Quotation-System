import { CustomizationType, InvoiceItemType, InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { Request, Router } from "express";
import { cloudinary, cloudinaryFolders } from "../services/cloudinary.service";
import { calculatePricing } from "../utils/pricing";
import { prisma } from "../utils/prisma";

export const invoiceRoutes = Router();

async function uploadDataUrl(dataUrl: string | undefined, folder: string, fileName: string) {
  if (!dataUrl) return null;
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(";")) || "application/octet-stream";
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder,
    resource_type: mimeType === "application/pdf" ? "raw" : "auto",
    public_id: fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-")
  });
  return {
    fileUrl: result.secure_url,
    cloudinaryPublicId: result.public_id,
    mimeType
  };
}

type MultipartFile = {
  fieldName: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

function uploadBuffer(file: MultipartFile | undefined, folder: string, fileName: string) {
  if (!file) return Promise.resolve(null);
  return new Promise<{ fileUrl: string; cloudinaryPublicId: string; mimeType: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: file.mimeType === "application/pdf" ? "raw" : "auto",
        public_id: fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, "-")
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Unable to upload file."));
        resolve({
          fileUrl: result.secure_url,
          cloudinaryPublicId: result.public_id,
          mimeType: file.mimeType
        });
      }
    );
    stream.end(file.buffer);
  });
}

async function readRequestBody(req: Request, limitBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limitBytes) throw Object.assign(new Error("Upload is too large. Please use smaller image files and try again."), { statusCode: 413 });
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function parseMultipartRequest(req: Request) {
  const contentType = req.headers["content-type"] ?? "";
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw new Error("Invalid multipart upload.");

  const body = (await readRequestBody(req, 40 * 1024 * 1024)).toString("latin1");
  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];

  for (const rawPart of body.split(`--${boundary}`)) {
    if (!rawPart || rawPart === "--\r\n" || rawPart === "--") continue;
    const part = rawPart.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd < 0) continue;
    const headerText = part.slice(0, headerEnd);
    const content = part.slice(headerEnd + 4).replace(/\r\n--$/, "");
    const disposition = /content-disposition:\s*form-data;\s*([^\r\n]+)/i.exec(headerText)?.[1] ?? "";
    const fieldName = /name="([^"]+)"/i.exec(disposition)?.[1];
    if (!fieldName) continue;
    const fileName = /filename="([^"]*)"/i.exec(disposition)?.[1];
    const mimeType = /content-type:\s*([^\r\n]+)/i.exec(headerText)?.[1]?.trim() ?? "application/octet-stream";
    if (fileName) {
      files.push({ fieldName, fileName, mimeType, buffer: Buffer.from(content, "latin1") });
    } else {
      fields[fieldName] = Buffer.from(content, "latin1").toString("utf8");
    }
  }

  return { fields, files };
}

function toInvoicePayload(record: any) {
  return {
    ...record.metadata,
    invoiceStatus: record.status,
    paymentStatus: record.paymentStatus,
    invoicePdfUrl: record.invoicePdfUrl,
    receiptUrl: record.paymentReceipts?.[0]?.fileUrl,
    receiptMimeType: record.paymentReceipts?.[0]?.mimeType,
    invoiceFiles: record.invoiceFiles?.map((file: any) => ({
      fileUrl: file.fileUrl,
      fileName: file.fileName,
      mimeType: file.mimeType
    })) ?? [],
    customizationUrls: record.customizationFiles?.map((file: any) => ({
      type: file.type,
      designKey: file.designKey,
      fileUrl: file.fileUrl,
      fileName: file.fileName,
      mimeType: file.mimeType,
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
    const isMultipart = req.headers["content-type"]?.includes("multipart/form-data");
    const multipart = isMultipart ? await parseMultipartRequest(req) : null;
    const data = multipart ? JSON.parse(multipart.fields.payload ?? "{}") : req.body;
    const filesByField = new Map((multipart?.files ?? []).map((file) => [file.fieldName, file]));
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: data.quotation.quotationNo },
      include: { customer: true, dates: true }
    });
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    if (quotation.status !== "APPROVED") return res.status(403).json({ error: "Quotation is still pending approval" });

    const pricing = calculatePricing(data.quotation);
    const invoiceNo = data.invoiceNo || `A${String((await prisma.invoice.count()) + 1).padStart(5, "0")}`;
    const receiptUpload = filesByField.has("receipt")
      ? await uploadBuffer(filesByField.get("receipt"), cloudinaryFolders.receipts, `${invoiceNo}-${data.receiptName || filesByField.get("receipt")?.fileName || "receipt"}`)
      : await uploadDataUrl(data.receiptDataUrl, cloudinaryFolders.receipts, `${invoiceNo}-${data.receiptName || "receipt"}`);

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
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true }
    });

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
          ? await uploadBuffer(filesByField.get(formField), group.folder, `${invoiceNo}-${group.type}-${designKey}-${design?.fileName || filesByField.get(formField)?.fileName || "design"}`)
          : await uploadDataUrl(design?.dataUrl, group.folder, `${invoiceNo}-${group.type}-${designKey}-${design?.fileName || "design"}`);
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
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true }
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
      include: { paymentReceipts: true, customizationFiles: true }
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(toInvoicePayload(invoice));
  } catch (error) {
    next(error);
  }
});
