import { randomBytes } from "node:crypto";
import { Prisma, QuotationStatus } from "@prisma/client";
import {
  CART_STYLE_LABELS,
  PACKAGE_OPTION_LABELS,
  calculateQuotationPricing as calculateFixedPackagePricing,
  validatePricingInput,
  getQuotationBaristaPricing,
  type CartStyle,
  type PackageCode,
  type PackageOptionCode,
  type PricingInput as FixedPricingInput
} from "@hour-coffee/shared";
import { Router } from "express";
import { getServiceHoursExact } from "../utils/pricing";
import { cloudinaryFolders, deleteCloudinaryPdf, uploadCloudinaryBuffer } from "../services/cloudinary.service";
import { prisma } from "../utils/prisma";
import { toInvoicePayload } from "../utils/invoice-payload";
import { parseMultipartRequest } from "../utils/multipart";
import { getFixedPackages } from "./packages";
import { isTrackingId, recordQuotationTracking } from "../services/quotation-tracking";
import { sendNotification } from "../services/notifications";
import { assertValidQuotationTransition, expireOverdueQuotations, isUniqueConflict } from "../utils/state-machine";

export const quotationRoutes = Router();
const LOCKED_DATE_MESSAGE = "One or more selected dates are no longer available. Please choose another date.";

type QuotationPdfLogDetails = {
  quotationId: string | null;
  quotationNo: string | null;
  success: boolean;
  secureUrl?: string | null;
  publicId?: string | null;
  error?: string;
  bytes?: number;
};

function logQuotationPdf(stage: "pdf_generation" | "cloudinary_upload" | "database_save", details: QuotationPdfLogDetails): void {
  const log = details.success ? console.info : console.error;
  log(`[quotation-pdf] ${stage}`, details);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function toQuotationPayload(record: any) {
  const metadata = record.metadata ?? {};
  const { portalToken: _portalToken, ...publicMetadata } = metadata;
  return {
    ...publicMetadata,
    pricingSnapshot: {
      ...metadata.pricingSnapshot,
      packageAmount: metadata.packageSnapshot?.price ?? metadata.pricingSnapshot?.packageAmount
        ?? Math.max(0, Number(record.subtotalAmount ?? metadata.pricingSnapshot?.subtotal ?? 0) - (record.extraCharges ?? []).filter((charge: any) => String(charge.title).trim().toLowerCase() !== "extra serving hour").reduce((sum: number, charge: any) => sum + Number(charge.amount), 0))
    },
    id: record.id,
    quotationNo: record.quotationNo,
    status: record.status,
    quotationPdfUrl: record.quotationPdfUrl,
    quotationPdfPublicId: record.quotationPdfPublicId,
    extraCharges: record.extraCharges?.filter((charge: any) => String(charge.title).trim().toLowerCase() !== "extra serving hour").map((charge: any) => ({
      id: charge.id,
      title: charge.title,
      description: charge.description ?? undefined,
      amount: Number(charge.amount),
      appliesToAllDates: !charge.dates?.length,
      serviceDateIds: (charge.dates ?? []).map((mapping: any) => {
        const iso = new Date(mapping.quotationDate.serviceDate).toISOString().slice(0, 10);
        return (metadata.serviceDates ?? []).find((date: any) => date.serviceDate === iso)?.id;
      }).filter(Boolean),
      createdAt: charge.createdAt?.toISOString?.() ?? charge.createdAt,
      updatedAt: charge.updatedAt?.toISOString?.() ?? charge.updatedAt
    })) ?? [],
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    hasInvoice: Array.isArray(record.invoices) ? record.invoices.length > 0 : undefined,
    voidedAt: record.voidedAt?.toISOString?.() ?? record.voidedAt ?? null,
    voidReason: record.voidReason ?? null,
    returnReason: record.returnReason ?? null,
    returnedAt: record.returnedAt?.toISOString?.() ?? record.returnedAt ?? null,
    editHistory: record.statusHistory?.filter((entry: any) => !/follow[ -]?up/i.test(String(entry.changeSummary ?? ""))).map((entry: any) => ({
      changedAt: entry.createdAt?.toISOString?.() ?? entry.createdAt,
      changedBy: entry.changedBy,
      summary: entry.changeSummary
    })) ?? []
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("60") ? `0${digits.slice(2)}` : digits;
}

function normalizeIdentityText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function customerIdentityMatches(customer: { name: string; phone: string; email: string }, input: { name: unknown; phone: unknown; email?: unknown }, requireEmail: boolean): boolean {
  const nameMatches = normalizeIdentityText(customer.name) === normalizeIdentityText(input.name);
  const phoneMatches = Boolean(normalizePhone(input.phone)) && normalizePhone(customer.phone) === normalizePhone(input.phone);
  const emailMatches = !requireEmail || normalizeIdentityText(customer.email) === normalizeIdentityText(input.email);
  return nameMatches && phoneMatches && emailMatches;
}

async function findMatchingCustomers(input: { name: unknown; phone: unknown; email: unknown }) {
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim();
  if (!name || !email || !normalizePhone(input.phone)) return [];
  const candidates = await prisma.customer.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      email: { equals: email, mode: "insensitive" }
    }
  });
  return candidates.filter((customer) => customerIdentityMatches(customer, input, true));
}

async function getNextQuotationNo(): Promise<string> {
  const [result] = await prisma.$queryRaw<Array<{ highestNumber: number }>>(Prisma.sql`
    SELECT COALESCE(MAX(SUBSTRING("quotationNo" FROM 2)::INTEGER), 0)::INTEGER AS "highestNumber"
    FROM "Quotation"
    WHERE "quotationNo" ~ '^Q[0-9]{5}$'
  `);
  // Auto-avoid already-used numbers: walk upward until an unused number is
  // found (handles gaps left by cancelled records or concurrent inserts).
  let nextNumber = result.highestNumber + 1;
  for (;;) {
    if (nextNumber > 99999) throw new Error("Quotation number range exhausted.");
    const candidate = `Q${String(nextNumber).padStart(5, "0")}`;
    const taken = await prisma.quotation.findUnique({ where: { quotationNo: candidate }, select: { id: true } });
    if (!taken) return candidate;
    nextNumber += 1;
  }
}

function isQuotationNoConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes("quotationNo") : String(target ?? "").includes("quotationNo");
}

function minimumServiceDateIso(now = new Date()): string {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 6);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseFixedPricingInput(body: any): { error?: string; discountCode?: string; input?: FixedPricingInput } {
  const totalCups = Number(body.totalCups);
  const selectedDates = Array.isArray(body.selectedDates)
    ? body.selectedDates.map((value: unknown) => String(value))
    : Array.isArray(body.serviceDates)
      ? body.serviceDates.map((date: any) => String(date?.serviceDate ?? ""))
      : [];
  const discountCode = String(body.discountCode ?? "").trim().toUpperCase();
  const requestedDuration = String(body.serviceDuration ?? "HALF_DAY").toUpperCase();
  if (discountCode && discountCode !== "FIRST") return { error: "Invalid discount code." };
  if (requestedDuration !== "HALF_DAY" && requestedDuration !== "FULL_DAY") return { error: "Choose Half Day or Full Day." };
  if (selectedDates.some((date: string) => date < minimumServiceDateIso())) {
    return { error: "One or more event dates are unavailable. Please choose a date at least 6 days from today." };
  }

  const input: FixedPricingInput = {
    totalCups,
    selectedDates,
    serviceDuration: requestedDuration,
    packageCode: String(body.packageCode ?? "") as PackageCode,
    extendToEightHours: Boolean(body.extendToEightHours),
    ...(body.cartStyle ? { cartStyle: String(body.cartStyle) as CartStyle } : {}),
    selectedOptions: Array.isArray(body.selectedOptions) ? body.selectedOptions.map(String) as PackageOptionCode[] : [],
    discountPercent: discountCode === "FIRST" ? 5 : 0
  };
  const validation = validatePricingInput(input);
  if (!validation.valid) return { error: validation.validationMessages[0] ?? "Invalid quotation configuration." };
  return { input: validation.normalizedInput, discountCode };
}

function publicPricingPreview(pricing: ReturnType<typeof calculateFixedPackagePricing>, packageDisplay: Awaited<ReturnType<typeof getFixedPackages>>[number]) {
  const selectedItems = [
    ...packageDisplay.includedItems,
    ...(pricing.cartStyle ? [CART_STYLE_LABELS[pricing.cartStyle]] : []),
    ...pricing.selectedOptions.map((option) => PACKAGE_OPTION_LABELS[option]),
    ...(pricing.extendedToEightHours ? ["Extended 8-hour service"] : [])
  ].filter((item, index, items) => items.indexOf(item) === index);
  return {
    valid: true,
    validationMessages: [],
    finalTotal: pricing.finalTotal,
    subtotal: pricing.subtotal,
    extendedDayCharge: pricing.extendedDayCharge,
    packageDisplay,
    selectedItems,
    averageCupsPerDay: pricing.averageCupsPerDay,
    baristasPerDay: pricing.baristasPerDay,
    requiredBaristas: pricing.requiredBaristas,
    extraBaristas: pricing.extraBaristas,
    extraBaristaFee: pricing.extraBaristaFee,
    standardServiceHours: pricing.standardServiceHours,
    extendedToEightHours: pricing.extendedToEightHours
  };
}

quotationRoutes.get("/next-number", async (_req, res, next) => {
  try {
    res.json({ quotationNo: await getNextQuotationNo() });
  } catch (error) {
    next(error);
  }
});

quotationRoutes.post("/preview", async (req, res, next) => {
  try {
    const parsed = parseFixedPricingInput(req.body);
    if (parsed.error || !parsed.input) return res.status(400).json({ valid: false, validationMessages: [parsed.error ?? "Invalid quotation configuration."] });
    const packageDisplay = (await getFixedPackages()).find((item) => req.body.selectedPackageId ? item.id === String(req.body.selectedPackageId) : item.code === parsed.input!.packageCode);
    if (!packageDisplay) return res.status(400).json({ valid: false, validationMessages: ["Choose a valid package."] });
    if (packageDisplay.code !== parsed.input.packageCode) return res.status(400).json({ valid: false, validationMessages: ["The selected package details do not match."] });
    const pricing = calculateFixedPackagePricing({ ...parsed.input, packageFeatures: packageDisplay.includedItems });
    res.json(publicPricingPreview(pricing, packageDisplay));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.post("/", async (req, res, next) => {
  try {
    const isMultipart = req.headers["content-type"]?.includes("multipart/form-data");
    const multipart = isMultipart ? await parseMultipartRequest(req, 30 * 1024 * 1024) : null;
    const incomingData = multipart ? JSON.parse(multipart.fields.payload ?? "{}") : req.body;
    const submittedQuotationNo = String(incomingData.quotationNo ?? "").trim().toUpperCase() || null;
    const tracking = incomingData.quotationTracking;
    if (!isTrackingId(tracking?.visitorId) || !isTrackingId(tracking?.sessionId)) {
      return res.status(400).json({ error: "A valid daily quotation session is required." });
    }
    // Idempotency: reject a resubmission that carries the same unique token.
    const submissionToken = String(incomingData.submissionToken ?? "").trim() || undefined;
    if (submissionToken) {
      const duplicate = await prisma.quotation.findUnique({ where: { submissionToken }, select: { quotationNo: true, status: true } });
      if (duplicate) {
        return res.status(409).json({
          code: "ALREADY_SUBMITTED",
          error: "This quotation was already submitted. Please use the confirmation number shown after your first submission.",
          quotationNo: duplicate.quotationNo
        });
      }
    }
    const quotationPdfFile = multipart?.files.find((file) => file.fieldName === "quotationPdf");
    if (!quotationPdfFile) {
      logQuotationPdf("pdf_generation", {
        quotationId: null,
        quotationNo: submittedQuotationNo,
        success: false,
        error: "Generated quotation PDF was missing from the submission."
      });
      return res.status(400).json({ error: "Quotation submission failed because the generated PDF was not received. Please try again." });
    }
    if (quotationPdfFile.mimeType !== "application/pdf" || quotationPdfFile.buffer.length === 0) {
      logQuotationPdf("pdf_generation", {
        quotationId: null,
        quotationNo: submittedQuotationNo,
        success: false,
        error: quotationPdfFile.buffer.length === 0 ? "Generated quotation PDF was empty." : `Unexpected PDF MIME type: ${quotationPdfFile.mimeType}`,
        bytes: quotationPdfFile.buffer.length
      });
      return res.status(400).json({ error: "The submitted quotation document must be a PDF." });
    }
    logQuotationPdf("pdf_generation", {
      quotationId: null,
      quotationNo: submittedQuotationNo,
      success: true,
      bytes: quotationPdfFile.buffer.length
    });
    const parsedPricing = parseFixedPricingInput(incomingData);
    if (parsedPricing.error || !parsedPricing.input) return res.status(400).json({ error: parsedPricing.error ?? "Invalid quotation configuration." });
    const packageDisplay = (await getFixedPackages()).find((item) => incomingData.selectedPackageId ? item.id === String(incomingData.selectedPackageId) : item.code === parsedPricing.input!.packageCode);
    if (!packageDisplay) return res.status(400).json({ error: "Choose a valid package." });
    if (packageDisplay.code !== parsedPricing.input.packageCode) return res.status(400).json({ error: "The selected package details do not match." });
    const pricing = calculateFixedPackagePricing({ ...parsedPricing.input, packageFeatures: packageDisplay.includedItems });
    // Amount must match the system calculation. The client-generated PDF amount
    // is cross-checked here; mismatches are rejected instead of stored.
    const submittedTotal = Number(incomingData.pricingSnapshot?.total ?? incomingData.totalAmount);
    if (Number.isFinite(submittedTotal) && Math.abs(submittedTotal - Number(pricing.finalTotal)) > 0.01) {
      return res.status(409).json({
        code: "AMOUNT_MISMATCH",
        error: "The amount on the quotation does not match the system price. Please refresh the page and resubmit.",
        systemTotal: pricing.finalTotal
      });
    }
    const selectedLockDates = pricing.selectedDates.map((date) => new Date(`${date}T00:00:00.000Z`));
    if (await prisma.lockedDate.findFirst({ where: { date: { in: selectedLockDates } }, select: { id: true } })) {
      return res.status(409).json({ error: LOCKED_DATE_MESSAGE });
    }

    const customerName = String(incomingData.customer?.name ?? "").trim();
    const customerPhone = String(incomingData.customer?.phone ?? "").trim();
    const customerEmail = String(incomingData.customer?.email ?? "").trim();
    if (!customerName) return res.status(400).json({ error: "Customer full name is required." });
    if (!/^01\d{8,9}$/.test(normalizePhone(customerPhone))) return res.status(400).json({ error: "Enter a valid Malaysian phone number." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return res.status(400).json({ error: "Enter a valid email address." });

    const selectedLocation = String(incomingData.location ?? "").trim();
    const resolvedEventAddress = selectedLocation.startsWith("Others")
      ? String(incomingData.fullAddress ?? selectedLocation).trim()
      : selectedLocation;
    if (!resolvedEventAddress) {
      return res.status(400).json({ error: "Event address is required." });
    }
    const selectedAddons = [
      ...(pricing.cartStyle === "FOAM_BOARD_DISPLAY_CART" ? [{ name: CART_STYLE_LABELS.FOAM_BOARD_DISPLAY_CART, price: 250 }] : []),
      ...pricing.selectedOptions.map((option) => ({
        name: PACKAGE_OPTION_LABELS[option],
        price: option === "LATTE_ART" ? 200 : option === "FOAM_BOARD_STAND" ? 150 : option === "CUSTOM_SYRUP" ? 100 : pricing.sleeveCharge
      }))
    ];
    const serviceDuration = pricing.serviceDuration;
    const manpower = getQuotationBaristaPricing(pricing.totalCups, serviceDuration, pricing.selectedDates);
    const serviceDates = pricing.selectedDates.map((serviceDate, index) => ({
      id: `service-date-${index + 1}-${serviceDate}`,
      serviceDate,
      cups: manpower.perDate[index].cupsForDate,
      durationMode: serviceDuration,
      startTime: "09:00",
      endTime: serviceDuration === "FULL_DAY" ? "17:00" : "13:00"
    }));
    const normalizedData = {
      ...incomingData,
      customer: { ...incomingData.customer, name: customerName, phone: customerPhone, email: customerEmail },
      totalCups: pricing.totalCups,
      selectedDates: pricing.selectedDates,
      serviceDates,
      serviceDuration,
      packageCode: pricing.packageCode,
      extendToEightHours: pricing.extendedToEightHours,
      cartStyle: pricing.cartStyle,
      selectedOptions: pricing.selectedOptions,
      selectedPackageId: packageDisplay.id,
      discountCode: parsedPricing.discountCode,
      discountPercent: pricing.discountPercent,
      packageSnapshot: {
        id: packageDisplay.id,
        name: packageDisplay.name,
        level: pricing.packageCode,
        briefDescription: packageDisplay.shortDescription,
        price: pricing.subtotal,
        extendedDayCharge: pricing.extendedDayCharge,
        perks: publicPricingPreview(pricing, packageDisplay).selectedItems.map((name, displayOrder) => ({ id: `${pricing.packageCode}-${displayOrder}`, name, displayOrder })),
        packageCode: pricing.packageCode,
        packageName: packageDisplay.name,
        shortDescription: packageDisplay.shortDescription,
        totalCups: pricing.totalCups,
        selectedDates: pricing.selectedDates,
        averageCupsPerDay: pricing.averageCupsPerDay,
        baristasPerDay: pricing.baristasPerDay,
        standardServiceHours: pricing.standardServiceHours,
        extendedToEightHours: pricing.extendedToEightHours,
        cartStyle: pricing.cartStyle,
        selectedOptions: pricing.selectedOptions,
        includedItems: packageDisplay.includedItems,
        finalTotal: pricing.finalTotal
      },
      selectedAddons,
      hasCupStickers: false,
      hasCupSleeves: packageDisplay.includedItems.some((item) => item.trim().toLowerCase() === "standard cup sleeves") || pricing.selectedOptions.includes("CUP_SLEEVES"),
      drinkOrders: Object.fromEntries(serviceDates.map((date) => [date.id, {}])),
      drinkDistributionModeByDate: Object.fromEntries(serviceDates.map((date) => [date.id, "HOUR_COFFEE_DECIDES"])),
      excludedBeverageIdsByDate: Object.fromEntries(serviceDates.map((date) => [date.id, []])),
      beverageSnapshots: {},
      letHourCoffeeDecideDrinks: true
    };
    const pricedData = normalizedData;
    const data = {
      ...pricedData,
      pricingSnapshot: {
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        total: pricing.finalTotal,
        cupRate: pricing.cupRate,
        cupRevenue: pricing.cupRevenue,
        sleeveCharge: pricing.sleeveCharge,
        selectionCharge: pricing.selectionCharge,
        extensionLabor: pricing.extensionLabor,
        preTravelSubtotal: pricing.preTravelSubtotal,
        travel: pricing.travel
      },
      pricingBreakdown: {
        requiredBaristas: pricing.requiredBaristas,
        extraBaristas: pricing.extraBaristas,
        extraBaristaFee: pricing.extraBaristaFee,
        fullDayBaristaFeesByDate: [],
        extraServingHoursByDate: [],
        extraServingHourRate: 0,
        extraServingHourFeeByDate: [],
        totalExtraServingHourFee: pricing.extensionLabor
      }
    };

    const requestedQuotationNo = String(data.quotationNo ?? "").trim().toUpperCase();
    const quotationNo = await getNextQuotationNo();
    if (requestedQuotationNo !== quotationNo) {
      return res.status(409).json({
        code: "QUOTATION_NUMBER_CONFLICT",
        error: "The quotation number is no longer the next available number. Retrying with the current number.",
        nextQuotationNo: quotationNo
      });
    }

    const matchingCustomers = await findMatchingCustomers(data.customer);
    const existingCustomer = matchingCustomers[0];
    const customerData = {
      name: data.customer.name.trim(),
      phone: data.customer.phone,
      email: data.customer.email.trim(),
      companyName: data.customer.companyName || existingCustomer?.companyName || null,
      companyRegNo: data.customer.companyRegNo || existingCustomer?.companyRegNo || null,
      billingAddress: String(data.customer.billingAddress || existingCustomer?.billingAddress || "")
    };
    const customer = existingCustomer
      ? await prisma.customer.update({ where: { id: existingCustomer.id }, data: customerData })
      : await prisma.customer.create({ data: customerData });

    let quotationPdfUpload: Awaited<ReturnType<typeof uploadCloudinaryBuffer>> = null;
    let quotation: Prisma.QuotationGetPayload<{ include: { customer: true; extraCharges: true } }> | null = null;
    try {
      try {
        quotationPdfUpload = await uploadCloudinaryBuffer(
          quotationPdfFile,
          cloudinaryFolders.quotationPdfs,
          `${quotationNo}-${Date.now()}.pdf`
        );
        if (!quotationPdfUpload) throw new Error("Cloudinary returned no quotation PDF upload result.");
        logQuotationPdf("cloudinary_upload", {
          quotationId: null,
          quotationNo,
          success: true,
          secureUrl: quotationPdfUpload.fileUrl,
          publicId: quotationPdfUpload.cloudinaryPublicId
        });
      } catch (error) {
        logQuotationPdf("cloudinary_upload", {
          quotationId: null,
          quotationNo,
          success: false,
          error: errorMessage(error)
        });
        return res.status(502).json({ error: "Quotation submission failed while uploading the PDF. Please try again." });
      }

      quotation = await prisma.$transaction(async (tx) => {
        // Keep a concurrent manual lock from being inserted between this check and save.
        await tx.$executeRaw`LOCK TABLE "LockedDate" IN SHARE MODE`;
        if (await tx.lockedDate.findFirst({ where: { date: { in: selectedLockDates } }, select: { id: true } })) {
          throw new Error(LOCKED_DATE_MESSAGE);
        }
        const savedQuotation = await tx.quotation.create({
        data: {
        quotationNo,
        customerId: customer.id,
        submissionToken: submissionToken ?? null,
        status: (data.status ?? "PENDING_APPROVAL") as QuotationStatus,
        location: resolvedEventAddress,
        eventType: data.eventType === "Others" ? data.customEventType || data.eventType : String(data.eventType ?? ""),
        subtotalAmount: pricing.subtotal,
        discountPercent: data.discountPercent || 0,
        discountAmount: pricing.discountAmount,
        totalAmount: pricing.finalTotal,
        quotationPdfUrl: quotationPdfUpload?.fileUrl ?? null,
        quotationPdfPublicId: quotationPdfUpload?.cloudinaryPublicId ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        metadata: toJsonValue({ ...data, quotationTracking: undefined, extraCharges: undefined, quotationNo }),
        dates: {
          create: data.serviceDates.map((date: any) => ({
            serviceDate: new Date(`${date.serviceDate}T12:00:00`),
            cups: date.cups,
            serviceStartTime: date.startTime,
            serviceEndTime: date.endTime,
            serviceHours: getServiceHoursExact(date),
            baristaCount: manpower.perDate.find((entry) => entry.date === date.serviceDate)?.requiredBaristas ?? 0,
            extraBaristaFee: manpower.perDate.find((entry) => entry.date === date.serviceDate)?.extraBaristaFee ?? 0,
            distributionMode: data.drinkDistributionModeByDate[date.id],
          }))
        },
        addons: {
          create: data.selectedAddons.map((addon: any) => ({
              name: addon.name,
              price: addon.price || 0,
              isIncluded: !!addon.isIncluded,
              metadata: toJsonValue(addon)
            }))
        }
        },
        include: { customer: true, extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } } }
        });
        await recordQuotationTracking(tx, tracking, "submittedAt");
        return savedQuotation;
      });
      logQuotationPdf("database_save", {
        quotationId: quotation.id,
        quotationNo: quotation.quotationNo,
        success: true,
        secureUrl: quotation.quotationPdfUrl,
        publicId: quotation.quotationPdfPublicId
      });
    } catch (error) {
      logQuotationPdf("database_save", {
        quotationId: null,
        quotationNo,
        success: false,
        secureUrl: quotationPdfUpload?.fileUrl,
        publicId: quotationPdfUpload?.cloudinaryPublicId,
        error: errorMessage(error)
      });
      if (quotationPdfUpload?.cloudinaryPublicId) {
        await deleteCloudinaryPdf(quotationPdfUpload.cloudinaryPublicId).catch((cleanupError) => {
          console.error("[quotation-pdf] failed_upload_cleanup", {
            quotationId: null,
            quotationNo,
            publicId: quotationPdfUpload?.cloudinaryPublicId,
            error: errorMessage(cleanupError)
          });
        });
      }
      if (error instanceof Error && error.message === LOCKED_DATE_MESSAGE) {
        return res.status(409).json({ error: LOCKED_DATE_MESSAGE });
      }
      if (isQuotationNoConflict(error)) {
        return res.status(409).json({
          code: "QUOTATION_NUMBER_CONFLICT",
          error: "The quotation number was just used. Retrying with the next available number.",
          nextQuotationNo: await getNextQuotationNo()
        });
      }
      if (isUniqueConflict(error, "submissionToken")) {
        return res.status(409).json({
          code: "ALREADY_SUBMITTED",
          error: "This quotation was already submitted. Please use the confirmation number shown after your first submission."
        });
      }
      return res.status(500).json({ error: "Quotation submission failed while saving the PDF. No successful submission was recorded. Please try again." });
    }

    await sendNotification({
      type: "QUOTATION_SUBMITTED",
      recipient: { role: "admin", name: "Hour Coffee Admin" },
      title: `New quotation ${quotationNo} from ${quotation.customer.name}`,
      message: `${quotation.customer.name} (${quotation.customer.phone}) submitted quotation ${quotationNo} for ${pricing.finalTotal} RM.`,
      referenceNo: quotationNo,
      link: `/admin/quotations?no=${encodeURIComponent(quotationNo)}`
    });

    res.status(201).json(toQuotationPayload(quotation));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.get("/", async (_req, res, next) => {
  try {
    await expireOverdueQuotations();
    const quotations = await prisma.quotation.findMany({
      orderBy: { createdAt: "desc" },
      include: { invoices: { select: { id: true } }, dates: { orderBy: { serviceDate: "asc" } }, extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } } }
    });
    res.json(quotations.map(toQuotationPayload));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.get("/:quotationNo", async (req, res, next) => {
  try {
    await expireOverdueQuotations();
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: req.params.quotationNo },
      include: { invoices: { select: { id: true } }, dates: { orderBy: { serviceDate: "asc" } }, extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } }, statusHistory: { orderBy: { createdAt: "desc" } } }
    });
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    res.json(toQuotationPayload(quotation));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.post("/find", async (req, res, next) => {
  try {
    await expireOverdueQuotations();
    const { quotationNo, name, phone } = req.body;
    const normalizedQuotationNo = String(quotationNo ?? "").trim().toUpperCase();
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: normalizedQuotationNo },
      include: {
        customer: true,
        dates: { orderBy: { serviceDate: "asc" } },
        extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { paymentReceipts: true, customizationFiles: true, invoiceFiles: true }
        }
      }
    });
    if (!quotation) return res.status(404).json({ matched: false, access: "NOT_FOUND" });
    if (!customerIdentityMatches(quotation.customer, { name, phone }, false)) {
      return res.status(404).json({ matched: false, access: "NOT_FOUND" });
    }
    const existingInvoice = quotation.invoices[0];
    if (existingInvoice?.status === "DRAFT") {
      return res.json({ matched: true, access: "DRAFT_INVOICE", invoiceNo: existingInvoice.invoiceNo });
    }
    if (existingInvoice) {
      return res.json({
        matched: true,
        access: "SUBMITTED_INVOICE",
        invoiceNo: existingInvoice.invoiceNo,
        invoice: toInvoicePayload(existingInvoice)
      });
    }
    if (quotation.status === "EXPIRED") {
      return res.json({ matched: true, access: "QUOTATION_EXPIRED", quotationNo: quotation.quotationNo });
    }
    if (quotation.status === "CANCELLED") {
      return res.json({ matched: true, access: "QUOTATION_CANCELLED", quotationNo: quotation.quotationNo });
    }
    if (quotation.status !== "APPROVED") {
      return res.json({ matched: true, access: "PENDING_REVIEW", quotationNo: quotation.quotationNo });
    }
    res.json({ matched: true, access: "APPROVED", quotation: toQuotationPayload(quotation) });
  } catch (error) {
    next(error);
  }
});

quotationRoutes.post("/history", async (req, res, next) => {
  try {
    await expireOverdueQuotations();
    const customers = await findMatchingCustomers(req.body);
    if (!customers.length) return res.json({ matched: false, quotations: [] });
    const quotations = await prisma.quotation.findMany({
      where: { customerId: { in: customers.map((customer) => customer.id) } },
      orderBy: { createdAt: "desc" },
      include: {
        dates: { orderBy: { serviceDate: "asc" }, take: 1 },
        invoices: { select: { id: true }, take: 1 }
      }
    });
    res.json({
      matched: quotations.length > 0,
      quotations: quotations.map((quotation) => {
        const hasInvoice = quotation.invoices.length > 0;
        return {
          quotationNo: quotation.quotationNo,
          createdAt: quotation.createdAt.toISOString(),
          firstEventDate: quotation.dates[0]?.serviceDate.toISOString().slice(0, 10) ?? null,
          status: quotation.status,
          hasInvoice,
          canViewQuotation: !hasInvoice
        };
      })
    });
  } catch (error) {
    next(error);
  }
});

quotationRoutes.post("/:quotationNo/summary", async (req, res, next) => {
  try {
    await expireOverdueQuotations();
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: String(req.params.quotationNo).trim().toUpperCase() },
      include: { customer: true, dates: { orderBy: { serviceDate: "asc" } }, invoices: { select: { id: true }, take: 1 }, extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } } }
    });
    if (!quotation || !customerIdentityMatches(quotation.customer, req.body, true)) {
      return res.status(404).json({ access: "NOT_FOUND" });
    }
    if (quotation.invoices.length > 0) {
      return res.status(409).json({ access: "INVOICE_STARTED" });
    }
    if (quotation.status === "EXPIRED") {
      return res.status(409).json({ access: "QUOTATION_EXPIRED", message: "This quotation has expired." });
    }
    if (quotation.status === "CANCELLED") {
      return res.status(409).json({ access: "QUOTATION_CANCELLED", message: "This quotation has been voided." });
    }
    res.json({
      access: "QUOTATION_SUMMARY",
      quotation: { ...toQuotationPayload(quotation), createdAt: quotation.createdAt.toISOString() }
    });
  } catch (error) {
    next(error);
  }
});

quotationRoutes.patch("/:quotationNo/approve", async (req, res, next) => {
  try {
    await expireOverdueQuotations();
    const current = await prisma.quotation.findUnique({ where: { quotationNo: req.params.quotationNo }, select: { id: true, status: true, expiresAt: true, metadata: true } });
    if (!current) return res.status(404).json({ error: "Quotation not found" });
    if (current.expiresAt && new Date(current.expiresAt).getTime() < Date.now()) {
      return res.status(409).json({ error: "This quotation has expired and can no longer be approved." });
    }
    try {
      assertValidQuotationTransition(current.status, "APPROVED");
    } catch (error) {
      return res.status(409).json({ error: error instanceof Error ? error.message : "Illegal quotation status transition." });
    }
    const metadata = (current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata) ? current.metadata : {}) as Record<string, unknown>;
    const quotation = await prisma.quotation.update({
      where: { quotationNo: req.params.quotationNo },
      data: {
        status: "APPROVED",
        metadata: toJsonValue({ ...metadata, portalToken: typeof metadata.portalToken === "string" ? metadata.portalToken : randomBytes(32).toString("base64url") }),
        statusHistory: { create: { fromStatus: current.status, toStatus: "APPROVED", changedBy: "admin", changeSummary: "Quotation approved." } }
      },
      include: { customer: true, invoices: { select: { id: true } }, dates: { orderBy: { serviceDate: "asc" } }, extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } } }
    });
    await sendNotification({
      type: "QUOTATION_APPROVED",
      recipient: { role: "customer", name: quotation.customer.name, phone: quotation.customer.phone, email: quotation.customer.email },
      title: `Quotation ${quotation.quotationNo} approved`,
      message: "Your quotation was approved. You can now submit your invoice details.",
      referenceNo: quotation.quotationNo,
      link: `/customer/quotation/${encodeURIComponent(quotation.quotationNo)}/invoice`
    });
    res.json(toQuotationPayload(quotation));
  } catch (error) {
    next(error);
  }
});

// Customer resubmission: after admin returns a quotation for changes
// (RETURNED_FOR_EDIT), the customer may edit the original quotation and
// resubmit it, moving it back to PENDING_APPROVAL. The quotation number is
// preserved so the audit trail stays linked to one record.
quotationRoutes.patch("/:quotationNo/resubmit", async (req, res, next) => {
  try {
    const isMultipart = req.headers["content-type"]?.includes("multipart/form-data");
    const multipart = isMultipart ? await parseMultipartRequest(req, 30 * 1024 * 1024) : null;
    const incomingData = multipart ? JSON.parse(multipart.fields.payload ?? "{}") : req.body;
    const quotationPdfFile = multipart?.files.find((file) => file.fieldName === "quotationPdf");
    if (!quotationPdfFile || quotationPdfFile.mimeType !== "application/pdf" || quotationPdfFile.buffer.length === 0) {
      return res.status(400).json({ error: "The resubmitted quotation document must be a PDF." });
    }
    const current = await prisma.quotation.findUnique({
      where: { quotationNo: String(req.params.quotationNo).trim().toUpperCase() },
      include: { customer: true }
    });
    if (!current) return res.status(404).json({ error: "Quotation not found" });
    if (current.status !== "RETURNED_FOR_EDIT") {
      return res.status(409).json({ error: "This quotation cannot be resubmitted. It must be returned by the admin for changes first." });
    }
    try {
      assertValidQuotationTransition(current.status, "PENDING_APPROVAL");
    } catch (error) {
      return res.status(409).json({ error: error instanceof Error ? error.message : "Illegal quotation status transition." });
    }

    const customerInput = incomingData.customer ?? {};
    const customerName = String(customerInput.name ?? current.customer.name ?? "").trim();
    const customerPhone = normalizePhone(customerInput.phone ?? current.customer.phone ?? "");
    const customerEmail = String(customerInput.email ?? current.customer.email ?? "").trim();
    if (!customerName) return res.status(400).json({ error: "Customer full name is required." });
    if (!/^01\d{8,9}$/.test(customerPhone)) return res.status(400).json({ error: "Enter a valid Malaysian phone number." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return res.status(400).json({ error: "Enter a valid email address." });

    const selectedLocation = String(incomingData.location ?? current.location ?? "").trim();
    const resolvedEventAddress = selectedLocation.startsWith("Others")
      ? String(incomingData.fullAddress ?? selectedLocation).trim()
      : selectedLocation;
    if (!resolvedEventAddress) return res.status(400).json({ error: "Event address is required." });

    const metadata = { ...((current.metadata ?? {}) as Record<string, unknown>) };
    const editableKeys = ["location", "fullAddress", "eventType", "customEventType", "notes"] as const;
    for (const key of editableKeys) {
      if (incomingData[key] !== undefined) metadata[key] = incomingData[key];
    }
    const previousCustomer = (metadata.customer ?? {}) as Record<string, unknown>;
    metadata.customer = {
      ...previousCustomer,
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      companyName: String(customerInput.companyName ?? previousCustomer.companyName ?? current.customer.companyName ?? ""),
      companyRegNo: String(customerInput.companyRegNo ?? previousCustomer.companyRegNo ?? current.customer.companyRegNo ?? ""),
      billingAddress: String(customerInput.billingAddress ?? previousCustomer.billingAddress ?? current.customer.billingAddress ?? "")
    };

    let quotationPdfUpload: Awaited<ReturnType<typeof uploadCloudinaryBuffer>> = null;
    try {
      quotationPdfUpload = await uploadCloudinaryBuffer(
        quotationPdfFile,
        cloudinaryFolders.quotationPdfs,
        `${current.quotationNo}-${Date.now()}.pdf`
      );
      if (!quotationPdfUpload) throw new Error("Cloudinary returned no quotation PDF upload result.");
      logQuotationPdf("cloudinary_upload", {
        quotationId: current.id,
        quotationNo: current.quotationNo,
        success: true,
        secureUrl: quotationPdfUpload.fileUrl,
        publicId: quotationPdfUpload.cloudinaryPublicId
      });
    } catch (error) {
      logQuotationPdf("cloudinary_upload", {
        quotationId: current.id,
        quotationNo: current.quotationNo,
        success: false,
        error: errorMessage(error)
      });
      return res.status(502).json({ error: "Quotation resubmission failed while uploading the PDF. Please try again." });
    }

    const quotation = await prisma.$transaction(async (tx) => {
      if (current.quotationPdfPublicId) {
        await deleteCloudinaryPdf(current.quotationPdfPublicId).catch((cleanupError) => {
          console.error("[quotation-pdf] resubmit_old_pdf_cleanup", {
            quotationId: current.id,
            quotationNo: current.quotationNo,
            publicId: current.quotationPdfPublicId,
            error: errorMessage(cleanupError)
          });
        });
      }
      return tx.quotation.update({
        where: { quotationNo: current.quotationNo },
        data: {
          status: "PENDING_APPROVAL",
          location: resolvedEventAddress,
          quotationPdfUrl: quotationPdfUpload?.fileUrl ?? null,
          quotationPdfPublicId: quotationPdfUpload?.cloudinaryPublicId ?? null,
          returnReason: null,
          returnedAt: null,
          metadata: toJsonValue(metadata),
          customer: {
            update: {
              name: customerName,
              phone: customerPhone,
              email: customerEmail,
              companyName: String(customerInput.companyName ?? current.customer.companyName ?? ""),
              companyRegNo: String(customerInput.companyRegNo ?? current.customer.companyRegNo ?? ""),
              billingAddress: String(customerInput.billingAddress ?? current.customer.billingAddress ?? "")
            }
          },
          statusHistory: {
            create: { fromStatus: "RETURNED_FOR_EDIT", toStatus: "PENDING_APPROVAL", changedBy: "customer", changeSummary: "Customer edited and resubmitted the quotation." }
          }
        },
        include: { customer: true, invoices: { select: { id: true } }, dates: { orderBy: { serviceDate: "asc" } }, extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } } }
      });
    });
    logQuotationPdf("database_save", {
      quotationId: quotation.id,
      quotationNo: quotation.quotationNo,
      success: true,
      secureUrl: quotation.quotationPdfUrl,
      publicId: quotation.quotationPdfPublicId
    });

    await sendNotification({
      type: "QUOTATION_RESUBMITTED",
      recipient: { role: "admin", name: "Hour Coffee Admin" },
      title: `Quotation ${quotation.quotationNo} resubmitted by ${quotation.customer.name}`,
      message: `${quotation.customer.name} (${quotation.customer.phone}) resubmitted quotation ${quotation.quotationNo} after requested changes.`,
      referenceNo: quotation.quotationNo,
      link: `/admin/quotations/${encodeURIComponent(quotation.quotationNo)}`
    });

    res.json(toQuotationPayload(quotation));
  } catch (error) {
    next(error);
  }
});

// Soft delete: quotations are voided (CANCELLED + reason) instead of being
// physically removed, preserving the audit trail.
quotationRoutes.delete("/:quotationNo", async (req, res, next) => {
  try {
    const reason = String(req.body?.reason ?? "").trim() || "Voided by admin without a reason.";
    const current = await prisma.quotation.findUnique({
      where: { quotationNo: req.params.quotationNo },
      include: { invoices: { select: { id: true } } }
    });
    if (!current) return res.status(404).json({ error: "Quotation not found" });
    if (current.status === "CONVERTED_TO_INVOICE" || current.invoices.length > 0) {
      return res.status(409).json({ error: "This quotation already has an invoice and cannot be voided." });
    }
    if (current.status === "CANCELLED") return res.status(409).json({ error: "This quotation is already voided." });
    try {
      assertValidQuotationTransition(current.status, "CANCELLED");
    } catch (error) {
      return res.status(409).json({ error: error instanceof Error ? error.message : "Illegal quotation status transition." });
    }
    const quotation = await prisma.quotation.update({
      where: { quotationNo: req.params.quotationNo },
      data: {
        status: "CANCELLED",
        voidedAt: new Date(),
        voidReason: reason,
        statusHistory: { create: { fromStatus: current.status, toStatus: "CANCELLED", changedBy: "admin", changeSummary: `Voided: ${reason}` } }
      },
      include: { invoices: { select: { id: true } }, dates: { orderBy: { serviceDate: "asc" } }, extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } } }
    });
    res.json({ voided: true, quotation: toQuotationPayload(quotation) });
  } catch (error) {
    next(error);
  }
});
