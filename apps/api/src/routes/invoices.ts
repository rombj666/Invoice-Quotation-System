import { createHash } from "node:crypto";
import { CustomizationType, InvoiceItemType, InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { cloudinaryFolders, uploadCloudinaryBuffer, uploadCloudinaryDataUrl } from "../services/cloudinary.service";
import { calculatePricing, hasValidServiceDates } from "../utils/invoice-pricing";
import { CART_SELECTION_ERROR, hasCartAddonConflict } from "../utils/addons";
import { prisma } from "../utils/prisma";
import { toInvoicePayload } from "../utils/invoice-payload";
import { parseMultipartRequest } from "../utils/multipart";

export const invoiceRoutes = Router();

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function invoiceForCustomizationToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const paid = await prisma.invoice.findMany({
    where: { paymentStatus: "VERIFIED" },
    include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true, drinkSnapshots: { orderBy: { serviceDate: "asc" } } }
  });
  return paid.find((invoice) => (invoice.metadata as any)?.customizationAccess?.tokenHash === tokenHash) ?? null;
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
    if (!invoice) return res.status(404).json({ error: "This customization link is invalid or payment has not been verified." });
    const payload = toInvoicePayload(invoice);
    delete payload.customizationAccess;
    res.json(payload);
  } catch (error) { next(error); }
});

invoiceRoutes.post("/customization/:token", async (req, res, next) => {
  try {
    const invoice = await invoiceForCustomizationToken(req.params.token);
    if (!invoice) return res.status(404).json({ error: "This customization link is invalid or payment has not been verified." });
    const multipart = await parseMultipartRequest(req, 40 * 1024 * 1024);
    const data = JSON.parse(multipart.fields.payload ?? "{}");
    const metadata = (invoice.metadata ?? {}) as any;
    const allowedKinds = customizationKinds(metadata.quotation ?? {});
    const filesByField = new Map(multipart.files.map((file) => [file.fieldName, file]));
    const savedFiles: Array<Record<string, unknown>> = [];
    const invalidField = [...filesByField.keys()].find((fieldName) => {
      const kind = fieldName === "customMenu" || fieldName === "latteArt" ? fieldName : fieldName.split(":")[0];
      return !allowedKinds.has(kind);
    });
    if (invalidField) return res.status(400).json({ error: "This customization type is not included in the confirmed invoice." });

    for (const [fieldName, file] of filesByField) {
      const isMenu = fieldName === "customMenu";
      const isLatte = fieldName === "latteArt";
      const type: CustomizationType = fieldName.startsWith("cart:") ? "CART_DESIGN" : fieldName.startsWith("sleeve:") ? "CUP_SLEEVE" : "CUP_STICKER";
      const folder = isMenu ? cloudinaryFolders.invoices : isLatte ? cloudinaryFolders.cupStickers : type === "CART_DESIGN" ? cloudinaryFolders.cartDesigns : type === "CUP_SLEEVE" ? cloudinaryFolders.cupSleeves : cloudinaryFolders.cupStickers;
      const upload = await uploadCloudinaryBuffer(file, folder, `${invoice.invoiceNo}-${fieldName.replace(/[^a-z0-9-]/gi, "-")}-${file.fileName}`);
      if (!upload) continue;
      if (isMenu) {
        await prisma.invoiceFile.create({ data: { invoiceId: invoice.id, fileUrl: upload.fileUrl, cloudinaryPublicId: upload.cloudinaryPublicId, fileName: file.fileName, mimeType: upload.mimeType } });
      } else {
        await prisma.customizationFile.create({ data: { invoiceId: invoice.id, type, designKey: isLatte ? "latte-art" : fieldName.split(":").slice(1).join(":"), fileUrl: upload.fileUrl, cloudinaryPublicId: upload.cloudinaryPublicId, fileName: file.fileName, mimeType: upload.mimeType, metadata: toJsonValue({ physicalSize: data.physicalSizes?.[fieldName] ?? null, originalArtwork: true }) } });
      }
      savedFiles.push({ fieldName, fileUrl: upload.fileUrl, fileName: file.fileName, mimeType: upload.mimeType, physicalSize: isMenu ? { widthCm: 21, heightCm: 29.7 } : isLatte ? { diameterCm: 8 } : data.physicalSizes?.[fieldName] ?? null });
    }

    const setup = { eventAddress: String(data.eventAddress ?? ""), dressCode: String(data.dressCode ?? ""), customDressCode: String(data.customDressCode ?? ""), environment: String(data.environment ?? ""), environmentNotes: String(data.environmentNotes ?? ""), submittedAt: new Date().toISOString(), files: savedFiles };
    await prisma.invoice.update({ where: { id: invoice.id }, data: { metadata: toJsonValue({ ...metadata, customizationSubmission: setup }) } });
    res.json({ ok: true, invoiceNo: invoice.invoiceNo });
  } catch (error) { next(error); }
});

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
    const incomingData = multipart ? JSON.parse(multipart.fields.payload ?? "{}") : req.body;
    const data = incomingData;
    const filesByField = new Map((multipart?.files ?? []).map((file) => [file.fieldName, file]));
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: data.quotation.quotationNo },
      include: { customer: true, dates: { include: { drinks: true } } }
    });
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    if (quotation.status !== "APPROVED") return res.status(403).json({ error: "Quotation is still pending approval" });
    const savedQuotation = quotation.metadata as any;
    if (!savedQuotation) return res.status(409).json({ error: "The saved quotation data is unavailable." });
    if (!hasValidServiceDates(savedQuotation.serviceDates)) {
      return res.status(409).json({ error: "The saved quotation has invalid service-date cup quantities." });
    }
    if (hasCartAddonConflict(savedQuotation.selectedAddons)) {
      return res.status(400).json({ error: CART_SELECTION_ERROR });
    }
    data.quotation = savedQuotation;
    const existingInvoice = await prisma.invoice.findFirst({ where: { quotationId: quotation.id }, select: { invoiceNo: true, status: true } });
    if (existingInvoice) {
      return res.status(409).json({
        error: existingInvoice.status === "DRAFT" ? "An invoice draft already exists for this quotation." : "This quotation already has a submitted invoice.",
        access: existingInvoice.status === "DRAFT" ? "DRAFT_INVOICE" : "SUBMITTED_INVOICE",
        invoiceNo: existingInvoice.invoiceNo
      });
    }

    const pricing = calculatePricing(data.quotation);
    const invoiceNo = data.invoiceNo || `A${String((await prisma.invoice.count()) + 1).padStart(5, "0")}`;
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
        drinkSnapshots: {
          create: quotation.dates.flatMap((date) => date.drinks.map((drink) => ({
            serviceDateId: date.id,
            serviceDate: date.serviceDate,
            beverageId: drink.beverageId,
            beverageName: drink.drinkName,
            imageUrlSnapshot: drink.imageUrlSnapshot,
            icedAvailableSnapshot: drink.icedAvailableSnapshot,
            hotAvailableSnapshot: drink.hotAvailableSnapshot,
            iceCups: drink.iceCups,
            hotCups: drink.hotCups,
            isExcluded: drink.isExcluded,
            distributionMode: date.distributionMode
          })))
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
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true, drinkSnapshots: { orderBy: { serviceDate: "asc" } }, internalNotes: { orderBy: { createdAt: "desc" } }, statusHistory: { orderBy: { createdAt: "desc" } } }
    });

    if (customMenuUpload) {
      await prisma.invoiceFile.create({
        data: {
          invoiceId: invoice.id,
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
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true, drinkSnapshots: { orderBy: { serviceDate: "asc" } } }
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
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true, drinkSnapshots: { orderBy: { serviceDate: "asc" } } }
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
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true, drinkSnapshots: { orderBy: { serviceDate: "asc" } }, internalNotes: { orderBy: { createdAt: "desc" } }, statusHistory: { orderBy: { createdAt: "desc" } } }
    });
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    res.json(toInvoicePayload(invoice));
  } catch (error) {
    next(error);
  }
});
