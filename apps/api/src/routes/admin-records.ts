import { InvoiceItemType, InvoiceStatus, PaymentStatus, Prisma, QuotationStatus } from "@prisma/client";
import { Router } from "express";
import { cloudinaryFolders, deleteCloudinaryPdf, uploadCloudinaryBuffer } from "../services/cloudinary.service";
import { CART_SELECTION_ERROR, hasCartAddonConflict } from "../utils/addons";
import { toInvoicePayload } from "../utils/invoice-payload";
import { parseMultipartRequest } from "../utils/multipart";
import { calculatePricing, calculateQuotationPricing, getBaristasNeeded, getExtraBaristaFee, getServiceHoursExact, hasValidServiceDates } from "../utils/pricing";
import { prisma } from "../utils/prisma";
import { applyCurrentProductPricing, ensureProductAvailabilityDefaults } from "../utils/product-availability";
import { toQuotationPayload } from "./quotations";
import { validateAndNormalizeDrinkSelections } from "../utils/drink-selection";

export const adminRecordRoutes = Router();

const quotationStatuses = new Set<QuotationStatus>(["DRAFT", "PENDING_APPROVAL", "APPROVED", "REVIEWED", "SENT", "CONVERTED_TO_INVOICE", "CANCELLED"]);
const invoiceStatuses = new Set<InvoiceStatus>(["DRAFT", "SUBMITTED", "PENDING_PAYMENT_REVIEW", "PAID", "CONFIRMED", "CANCELLED"]);
const paymentStatuses = new Set<PaymentStatus>(["UNPAID", "RECEIPT_UPLOADED", "VERIFIED", "REJECTED"]);
const drinkNames: Record<string, string> = { americano: "Americano", latte: "Cafe Latte", chocolate: "Dark Chocolate", lemonade: "Lemonade" };

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function validateQuotationFields(data: any, allowSimplifiedQuotation = false): string | null {
  if (!String(data.customer?.name ?? "").trim()) return "Customer name is required.";
  if (!/^\S+@\S+\.\S+$/.test(String(data.customer?.email ?? ""))) return "A valid customer email is required.";
  if (String(data.customer?.phone ?? "").replace(/\D/g, "").length < 9) return "A valid customer phone number is required.";
  if (!allowSimplifiedQuotation && !String(data.customer?.billingAddress ?? "").trim()) return "Billing address is required.";
  if (!String(data.location ?? "").trim()) return "Event address is required.";
  if (!allowSimplifiedQuotation && !String(data.eventType ?? "").trim()) return "Event type is required.";
  const hasQuotationLevelSettings = data.totalCups !== undefined || data.serviceDuration !== undefined;
  if (hasQuotationLevelSettings && (!Number.isInteger(Number(data.totalCups)) || Number(data.totalCups) < 50)) return "Minimum order is 50 cups.";
  if (hasQuotationLevelSettings && data.serviceDuration !== "HALF_DAY" && data.serviceDuration !== "FULL_DAY") return "Choose Half Day or Full Day service duration.";
  if ((data.serviceDates ?? []).some((date: any) => date.durationMode
    ? date.durationMode !== "HALF_DAY" && date.durationMode !== "FULL_DAY"
    : !/^\d{2}:\d{2}$/.test(date.startTime) || !/^\d{2}:\d{2}$/.test(date.endTime) || date.endTime <= date.startTime)) return "Every service date must have a valid duration or time range.";
  const discount = Number(data.discountPercent);
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) return "Discount percent must be between 0 and 100.";
  return null;
}

function changedFields(before: any, after: any, keys: string[]): string[] {
  return keys.filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null));
}

function invoiceItems(pricing: ReturnType<typeof calculatePricing>) {
  return [
    {
      itemType: "COFFEE_SERVICE" as InvoiceItemType,
      name: "Coffee Catering",
      description: "Americano, Cafe Latte, Dark Chocolate, Lemonade",
      quantity: 1,
      unitPrice: pricing.baseAmount,
      amount: pricing.baseAmount
    },
    ...(pricing.extraBaristaFee > 0 ? [{ itemType: "EXTRA_BARISTA" as InvoiceItemType, name: "Extra Barista", description: "Extra barista fee based on service hours", quantity: 1, unitPrice: pricing.extraBaristaFee, amount: pricing.extraBaristaFee }] : []),
    ...(pricing.totalExtraServingHourFee > 0 ? [{ itemType: "EXTRA_SERVING_HOUR" as InvoiceItemType, name: "Extra Serving Hour", description: "Automatically calculated per service date below 100 cups", quantity: 1, unitPrice: pricing.totalExtraServingHourFee, amount: pricing.totalExtraServingHourFee, metadata: toJsonValue({ breakdown: pricing.extraServingHoursByDate }) }] : []),
    ...(pricing.machineRentalFee > 0 ? [{ itemType: "MACHINE_RENTAL" as InvoiceItemType, name: "Machine Rental", description: "Additional coffee machine rental", quantity: 1, unitPrice: pricing.machineRentalFee, amount: pricing.machineRentalFee }] : []),
    ...(pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee > 0 ? [{
      itemType: "ADDON" as InvoiceItemType,
      name: "Add-ons",
      description: "Selected quotation add-ons",
      quantity: 1,
      unitPrice: pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee,
      amount: pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee
    }] : [])
  ];
}

adminRecordRoutes.post("/quotations/:quotationNo/preview", async (req, res, next) => {
  try {
    const data = req.body;
    if (!hasValidServiceDates(data.serviceDates)) return res.status(400).json({ error: "Select at least one service date with a minimum of 50 whole cups per date." });
    const fieldError = validateQuotationFields(data, true);
    if (fieldError) return res.status(400).json({ error: fieldError });
    const normalizedDrinks = await validateAndNormalizeDrinkSelections(data, true);
    if (normalizedDrinks.error || !normalizedDrinks.data) return res.status(400).json({ error: normalizedDrinks.error });
    if (hasCartAddonConflict(data.selectedAddons)) return res.status(400).json({ error: CART_SELECTION_ERROR });
    await ensureProductAvailabilityDefaults();
    const pricingItems = await prisma.productAvailability.findMany({ where: { category: "Add-on Features" } });
    const pricedData = applyCurrentProductPricing(normalizedDrinks.data, pricingItems);
    const pricing = calculateQuotationPricing(pricedData, data.extraCharges ?? []);
    res.json({ ...pricedData, pricingSnapshot: { subtotal: pricing.subtotal, discountAmount: pricing.discountAmount, total: pricing.total }, pricingBreakdown: { requiredBaristas: pricing.requiredBaristas, extraBaristas: pricing.extraBaristas, extraBaristaFee: pricing.extraBaristaFee, fullDayBaristaFeesByDate: pricing.fullDayBaristaFeesByDate, extraServingHoursByDate: pricing.extraServingHoursByDate, extraServingHourRate: pricing.extraServingHourRate, extraServingHourFeeByDate: pricing.extraServingHourFeeByDate, totalExtraServingHourFee: pricing.totalExtraServingHourFee } });
  } catch (error) {
    next(error);
  }
});

adminRecordRoutes.patch("/quotations/:quotationNo", async (req, res, next) => {
  let newPdfPublicId: string | undefined;
  try {
    const multipart = await parseMultipartRequest(req, 30 * 1024 * 1024);
    const data = JSON.parse(multipart.fields.payload ?? "{}");
    const pdfFile = multipart.files.find((file) => file.fieldName === "quotationPdf");
    if (!pdfFile || pdfFile.mimeType !== "application/pdf") return res.status(400).json({ error: "A regenerated quotation PDF is required." });
    if (!hasValidServiceDates(data.serviceDates)) return res.status(400).json({ error: "Select at least one service date with a minimum of 50 whole cups per date." });
    const fieldError = validateQuotationFields(data, true);
    if (fieldError) return res.status(400).json({ error: fieldError });
    const normalizedDrinks = await validateAndNormalizeDrinkSelections(data, true);
    if (normalizedDrinks.error || !normalizedDrinks.data) return res.status(400).json({ error: normalizedDrinks.error });
    if (hasCartAddonConflict(data.selectedAddons)) return res.status(400).json({ error: CART_SELECTION_ERROR });
    if (!quotationStatuses.has(data.status)) return res.status(400).json({ error: "Invalid quotation status." });

    const current = await prisma.quotation.findUnique({
      where: { quotationNo: req.params.quotationNo },
      include: { customer: true, dates: true, invoices: { select: { id: true } }, extraCharges: { orderBy: { createdAt: "asc" } } }
    });
    if (!current) return res.status(404).json({ error: "Quotation not found" });

    await ensureProductAvailabilityDefaults();
    const pricingItems = await prisma.productAvailability.findMany({ where: { category: "Add-on Features" } });
    const pricedData = applyCurrentProductPricing(normalizedDrinks.data, pricingItems);
    const pricing = calculateQuotationPricing(pricedData, current.extraCharges);
    const quotationNo = String(data.quotationNo ?? "").trim().toUpperCase();
    if (!/^Q\d{5}$/.test(quotationNo)) return res.status(400).json({ error: "Quotation number must use the format Q00001." });
    const pdfUpload = await uploadCloudinaryBuffer(pdfFile, cloudinaryFolders.quotationPdfs, `${quotationNo}-${Date.now()}.pdf`);
    if (!pdfUpload) throw new Error("Unable to upload quotation PDF.");
    newPdfPublicId = pdfUpload.cloudinaryPublicId;
    const summaryFields = changedFields(current.metadata, data, ["quotationNo", "customer", "location", "fullAddress", "eventType", "customEventType", "serviceDates", "drinkOrders", "selectedAddons", "hasCupStickers", "hasCupSleeves", "discountPercent", "status"]);
    const metadata = { ...pricedData, extraCharges: undefined, quotationNo, pricingSnapshot: { subtotal: pricing.subtotal, discountAmount: pricing.discountAmount, total: pricing.total }, pricingBreakdown: { requiredBaristas: pricing.requiredBaristas, extraBaristas: pricing.extraBaristas, extraBaristaFee: pricing.extraBaristaFee, fullDayBaristaFeesByDate: pricing.fullDayBaristaFeesByDate, extraServingHoursByDate: pricing.extraServingHoursByDate, extraServingHourRate: pricing.extraServingHourRate, extraServingHourFeeByDate: pricing.extraServingHourFeeByDate, totalExtraServingHourFee: pricing.totalExtraServingHourFee } };
    const hasQuotationLevelSettings = Number.isFinite(pricedData.totalCups) && (pricedData.serviceDuration === "HALF_DAY" || pricedData.serviceDuration === "FULL_DAY");

    const updated = await prisma.$transaction(async (tx) => {
      await tx.customizationFile.updateMany({ where: { quotationDateId: { in: current.dates.map((date) => date.id) } }, data: { quotationDateId: null } });
      await tx.quotationDate.deleteMany({ where: { quotationId: current.id } });
      await tx.quotationAddon.deleteMany({ where: { quotationId: current.id } });
      await tx.customer.update({
        where: { id: current.customerId },
        data: {
          name: data.customer.name.trim(), phone: data.customer.phone, email: data.customer.email.trim(),
          companyName: data.customer.companyName || current.customer.companyName || null,
          companyRegNo: data.customer.companyRegNo || current.customer.companyRegNo || null,
          billingAddress: data.customer.billingAddress || current.customer.billingAddress || ""
        }
      });
      return tx.quotation.update({
        where: { id: current.id },
        data: {
          quotationNo,
          status: data.status,
          location: data.location.startsWith("Others") ? data.fullAddress || data.location : data.location,
          eventType: data.eventType === "Others" ? data.customEventType || data.eventType : data.eventType,
          subtotalAmount: pricing.subtotal, discountPercent: data.discountPercent || 0,
          discountAmount: pricing.discountAmount, totalAmount: pricing.total,
          quotationPdfUrl: pdfUpload.fileUrl, quotationPdfPublicId: pdfUpload.cloudinaryPublicId,
          metadata: toJsonValue(metadata),
          dates: { create: pricedData.serviceDates.map((date: any) => ({
            serviceDate: new Date(`${date.serviceDate}T12:00:00`), cups: Number(date.cups),
            serviceStartTime: date.startTime, serviceEndTime: date.endTime,
            serviceHours: getServiceHoursExact(date), baristaCount: hasQuotationLevelSettings ? pricing.requiredBaristas : getBaristasNeeded(date), extraBaristaFee: hasQuotationLevelSettings ? 0 : getExtraBaristaFee(date), distributionMode: pricedData.drinkDistributionModeByDate[date.id],
            drinks: { create: Object.entries(pricedData.drinkOrders[date.id] ?? {}).map(([drinkId, quantity]: [string, any]) => ({
              drinkId, beverageId: drinkId, drinkName: pricedData.beverageSnapshots[drinkId]?.name ?? drinkNames[drinkId] ?? drinkId, imageUrlSnapshot: pricedData.beverageSnapshots[drinkId]?.imageUrl ?? null, icedAvailableSnapshot: pricedData.beverageSnapshots[drinkId]?.icedAvailable ?? true, hotAvailableSnapshot: pricedData.beverageSnapshots[drinkId]?.hotAvailable ?? false, isExcluded: pricedData.excludedBeverageIdsByDate[date.id]?.includes(drinkId) ?? false, iceCups: Number(quantity.ice || 0), hotCups: Number(quantity.hot || 0), totalCups: Number(quantity.ice || 0) + Number(quantity.hot || 0)
            })) }
          })) },
          addons: { create: [
            ...pricedData.selectedAddons.map((addon: any) => ({ name: addon.name, price: addon.price || 0, isIncluded: !!addon.isIncluded, metadata: toJsonValue(addon) })),
            ...(pricedData.hasCupStickers ? [{ name: "Custom Cup Stickers", price: pricing.cupStickerFee, isIncluded: false, metadata: toJsonValue(pricedData.customizationOptions?.sticker ?? {}) }] : []),
            ...(pricedData.hasCupSleeves ? [{ name: "Custom Cup Sleeves", price: pricing.cupSleeveFee, isIncluded: false, metadata: toJsonValue(pricedData.customizationOptions?.sleeve ?? {}) }] : [])
          ] },
          statusHistory: { create: { fromStatus: current.status, toStatus: data.status, changedBy: "admin", changeSummary: `Edited: ${summaryFields.join(", ") || "quotation details"}.` } }
        },
        include: { invoices: { select: { id: true } }, extraCharges: { orderBy: { createdAt: "asc" } }, statusHistory: { orderBy: { createdAt: "desc" } } }
      });
    });
    void deleteCloudinaryPdf(current.quotationPdfPublicId).catch(() => undefined);
    res.json(toQuotationPayload(updated));
  } catch (error) {
    if (newPdfPublicId) void deleteCloudinaryPdf(newPdfPublicId).catch(() => undefined);
    next(error);
  }
});

adminRecordRoutes.patch("/invoices/:invoiceNo", async (req, res, next) => {
  let newPdfPublicId: string | undefined;
  try {
    const multipart = await parseMultipartRequest(req, 30 * 1024 * 1024);
    const data = JSON.parse(multipart.fields.payload ?? "{}");
    const pdfFile = multipart.files.find((file) => file.fieldName === "invoicePdf");
    if (!pdfFile || pdfFile.mimeType !== "application/pdf") return res.status(400).json({ error: "A regenerated invoice PDF is required." });
    if (!invoiceStatuses.has(data.invoiceStatus)) return res.status(400).json({ error: "Invalid invoice status." });
    if (!paymentStatuses.has(data.paymentStatus)) return res.status(400).json({ error: "Invalid payment status." });
    if (!hasValidServiceDates(data.quotation?.serviceDates)) return res.status(400).json({ error: "The invoice service dates are invalid." });
    const fieldError = validateQuotationFields(data.quotation, data.quotation?.serviceDates?.some((date: any) => Boolean(date.durationMode)));
    if (fieldError) return res.status(400).json({ error: fieldError });
    if (!String(data.eventAddress ?? "").trim()) return res.status(400).json({ error: "Event address is required." });
    if (hasCartAddonConflict(data.quotation.selectedAddons)) return res.status(400).json({ error: CART_SELECTION_ERROR });

    const current = await prisma.invoice.findUnique({
      where: { invoiceNo: req.params.invoiceNo },
      include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true }
    });
    if (!current) return res.status(404).json({ error: "Invoice not found" });
    const invoiceNo = String(data.invoiceNo ?? "").trim().toUpperCase();
    if (!/^A\d{5}$/.test(invoiceNo)) return res.status(400).json({ error: "Invoice number must use the format A00001." });
    const pricing = calculatePricing(data.quotation);
    const pdfUpload = await uploadCloudinaryBuffer(pdfFile, cloudinaryFolders.invoicePdfs, `${invoiceNo}-${Date.now()}.pdf`);
    if (!pdfUpload) throw new Error("Unable to upload invoice PDF.");
    newPdfPublicId = pdfUpload.cloudinaryPublicId;
    const before = (current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata) ? current.metadata : {}) as Record<string, unknown>;
    const summaryFields = changedFields(before, data, ["invoiceNo", "quotation", "eventAddress", "dressCode", "customDressCode", "environment", "environmentNotes", "invoiceStatus", "paymentStatus", "invoiceReference"]);
    const { internalNote: _internalNote, ...storedData } = data;
    const metadata = toJsonValue({ ...before, ...storedData, invoiceNo, receiptDataUrl: undefined, pricingSnapshot: { subtotal: pricing.subtotal, discountAmount: pricing.discountAmount, total: pricing.total } });

    const updated = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: current.id } });
      if (String(data.internalNote ?? "").trim()) {
        await tx.internalNote.create({ data: { invoiceId: current.id, note: String(data.internalNote).trim(), createdBy: "admin" } });
      }
      return tx.invoice.update({
        where: { id: current.id },
        data: {
          invoiceNo,
          status: data.invoiceStatus,
          paymentStatus: data.paymentStatus,
          eventAddress: data.eventAddress || null,
          dressCode: data.dressCode === "Custom" ? data.customDressCode || data.dressCode : data.dressCode || null,
          environmentNotes: [data.environment, data.environmentNotes].filter(Boolean).join(" - ") || null,
          finalSubtotalAmount: pricing.subtotal, finalDiscountAmount: pricing.discountAmount, finalTotalAmount: pricing.total,
          invoicePdfUrl: pdfUpload.fileUrl, invoicePdfPublicId: pdfUpload.cloudinaryPublicId,
          metadata,
          items: { create: invoiceItems(pricing) },
          statusHistory: { create: { fromStatus: current.status, toStatus: data.invoiceStatus, changedBy: "admin", changeSummary: `Edited: ${summaryFields.join(", ") || "invoice details"}.` } }
        },
        include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true, internalNotes: { orderBy: { createdAt: "desc" } }, statusHistory: { orderBy: { createdAt: "desc" } } }
      });
    });
    void deleteCloudinaryPdf(current.invoicePdfPublicId).catch(() => undefined);
    res.json(toInvoicePayload(updated));
  } catch (error) {
    if (newPdfPublicId) void deleteCloudinaryPdf(newPdfPublicId).catch(() => undefined);
    next(error);
  }
});
