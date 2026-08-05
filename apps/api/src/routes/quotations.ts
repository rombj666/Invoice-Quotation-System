import { Prisma, QuotationStatus } from "@prisma/client";
import { Router } from "express";
import { calculatePricing, getBaristasNeeded, getExtraBaristaFee, getServiceHoursExact, hasValidServiceDates } from "../utils/pricing";
import { CART_SELECTION_ERROR, hasCartAddonConflict } from "../utils/addons";
import { cloudinaryFolders, deleteCloudinaryPdf, uploadCloudinaryBuffer } from "../services/cloudinary.service";
import { prisma } from "../utils/prisma";
import { toInvoicePayload } from "../utils/invoice-payload";
import { parseMultipartRequest } from "../utils/multipart";
import { applyCurrentProductPricing, ensureProductAvailabilityDefaults } from "../utils/product-availability";

export const quotationRoutes = Router();

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

const drinkNames: Record<string, string> = {
  americano: "Americano",
  latte: "Cafe Latte",
  chocolate: "Dark Chocolate",
  lemonade: "Lemonade"
};

export function toQuotationPayload(record: any) {
  return {
    ...record.metadata,
    id: record.id,
    quotationNo: record.quotationNo,
    status: record.status,
    quotationPdfUrl: record.quotationPdfUrl,
    quotationPdfPublicId: record.quotationPdfPublicId,
    extraCharges: record.extraCharges?.map((charge: any) => ({
      id: charge.id,
      title: charge.title,
      description: charge.description ?? undefined,
      amount: Number(charge.amount),
      createdAt: charge.createdAt?.toISOString?.() ?? charge.createdAt,
      updatedAt: charge.updatedAt?.toISOString?.() ?? charge.updatedAt
    })) ?? [],
    followUpStatus: record.followUpStatus,
    lastFollowedUpAt: record.lastFollowedUpAt?.toISOString?.() ?? record.lastFollowedUpAt,
    followUpNote: record.followUpNote,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    hasInvoice: Array.isArray(record.invoices) ? record.invoices.length > 0 : undefined,
    editHistory: record.statusHistory?.map((entry: any) => ({
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
  const latest = await prisma.quotation.findFirst({
    orderBy: { quotationNo: "desc" },
    select: { quotationNo: true }
  });
  const latestNumber = Number(latest?.quotationNo.replace(/^Q/, "") ?? "0");
  return `Q${String(latestNumber + 1).padStart(5, "0")}`;
}

quotationRoutes.get("/next-number", async (_req, res, next) => {
  try {
    res.json({ quotationNo: await getNextQuotationNo() });
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
    if (incomingData.anonymousSessionId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(incomingData.anonymousSessionId)) {
      return res.status(400).json({ error: "Invalid anonymous quotation session." });
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
    if (!hasValidServiceDates(incomingData.serviceDates)) {
      return res.status(400).json({ error: "Select at least one service date with a minimum of 50 whole cups per date." });
    }
    if (hasCartAddonConflict(incomingData.selectedAddons)) {
      return res.status(400).json({ error: CART_SELECTION_ERROR });
    }
    if (incomingData.anonymousSessionId) {
      const trackedSubmission = await prisma.quotationAnalyticsSession.findUnique({
        where: { anonymousSessionId: incomingData.anonymousSessionId },
        include: { quotation: { include: { invoices: { select: { id: true } }, extraCharges: { orderBy: { createdAt: "asc" } } } } }
      });
      if (trackedSubmission?.quotation) {
        const storedPdf = Boolean(trackedSubmission.quotation.quotationPdfUrl && trackedSubmission.quotation.quotationPdfPublicId);
        logQuotationPdf("database_save", {
          quotationId: trackedSubmission.quotation.id,
          quotationNo: trackedSubmission.quotation.quotationNo,
          success: storedPdf,
          secureUrl: trackedSubmission.quotation.quotationPdfUrl,
          publicId: trackedSubmission.quotation.quotationPdfPublicId,
          ...(!storedPdf ? { error: "Existing submission has no stored quotation PDF." } : {})
        });
        if (!storedPdf) {
          return res.status(409).json({ error: "This quotation exists without a stored PDF and cannot be reported as fully submitted." });
        }
        return res.json(toQuotationPayload(trackedSubmission.quotation));
      }
    }
    await ensureProductAvailabilityDefaults();
    const pricingItems = await prisma.productAvailability.findMany({ where: { category: "Add-on Features" } });
    const pricedData = applyCurrentProductPricing(incomingData, pricingItems);
    const pricing = calculatePricing(pricedData);
    const data = {
      ...pricedData,
      pricingSnapshot: {
        subtotal: pricing.subtotal,
        discountAmount: pricing.discountAmount,
        total: pricing.total
      }
    };

    const matchingCustomers = await findMatchingCustomers(data.customer);
    const customerData = {
      name: data.customer.name.trim(),
      phone: data.customer.phone,
      email: data.customer.email.trim(),
      companyName: data.customer.companyName || null,
      companyRegNo: data.customer.companyRegNo || null,
      billingAddress: data.customer.billingAddress
    };
    const customer = matchingCustomers[0]
      ? await prisma.customer.update({ where: { id: matchingCustomers[0].id }, data: customerData })
      : await prisma.customer.create({ data: customerData });

    let quotation = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const requestedQuotationNo = String(data.quotationNo ?? "").trim().toUpperCase();
      const quotationNo = attempt === 0 && /^Q\d{5}$/.test(requestedQuotationNo)
        ? requestedQuotationNo
        : await getNextQuotationNo();
      let quotationPdfUpload: Awaited<ReturnType<typeof uploadCloudinaryBuffer>> = null;
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

        quotation = await prisma.quotation.create({
          data: {
        quotationNo,
        customerId: customer.id,
        status: (data.status ?? "PENDING_APPROVAL") as QuotationStatus,
        location: data.location.startsWith("Others") ? data.fullAddress || data.location : data.location,
        eventType: data.eventType === "Others" ? data.customEventType || data.eventType : data.eventType,
        subtotalAmount: pricing.subtotal,
        discountPercent: data.discountPercent || 0,
        discountAmount: pricing.discountAmount,
        totalAmount: pricing.total,
        quotationPdfUrl: quotationPdfUpload?.fileUrl ?? null,
        quotationPdfPublicId: quotationPdfUpload?.cloudinaryPublicId ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        metadata: toJsonValue({ ...data, anonymousSessionId: undefined, extraCharges: undefined, quotationNo }),
        dates: {
          create: data.serviceDates.map((date: any) => ({
            serviceDate: new Date(`${date.serviceDate}T12:00:00`),
            cups: date.cups,
            serviceStartTime: date.startTime,
            serviceEndTime: date.endTime,
            serviceHours: getServiceHoursExact(date),
            baristaCount: getBaristasNeeded(date),
            extraBaristaFee: getExtraBaristaFee(date),
            drinks: {
              create: Object.entries(data.drinkOrders[date.id] ?? {}).map(([drinkId, quantity]: [string, any]) => ({
                drinkId,
                drinkName: drinkNames[drinkId] ?? drinkId,
                iceCups: quantity.ice || 0,
                hotCups: quantity.hot || 0,
                totalCups: (quantity.ice || 0) + (quantity.hot || 0)
              }))
            }
          }))
        },
        addons: {
          create: [
            ...data.selectedAddons.map((addon: any) => ({
              name: addon.name,
              price: addon.price || 0,
              isIncluded: !!addon.isIncluded,
              metadata: toJsonValue(addon)
            })),
            ...(data.hasCupStickers ? [{ name: "Custom Cup Stickers", price: pricing.cupStickerFee, isIncluded: false, metadata: toJsonValue(data.customizationOptions?.sticker ?? {}) }] : []),
            ...(data.hasCupSleeves ? [{ name: "Custom Cup Sleeves", price: pricing.cupSleeveFee, isIncluded: false, metadata: toJsonValue(data.customizationOptions?.sleeve ?? {}) }] : [])
          ]
        }
          },
          include: { customer: true, extraCharges: { orderBy: { createdAt: "asc" } } }
        });
        logQuotationPdf("database_save", {
          quotationId: quotation.id,
          quotationNo: quotation.quotationNo,
          success: true,
          secureUrl: quotation.quotationPdfUrl,
          publicId: quotation.quotationPdfPublicId
        });
        break;
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
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return res.status(409).json({ error: "The quotation number was just used. Please refresh and submit again so the PDF matches the quotation." });
        }
        return res.status(500).json({ error: "Quotation submission failed while saving the PDF. No successful submission was recorded. Please try again." });
      }
    }

    if (!quotation) {
      return res.status(409).json({ error: "Unable to generate a unique quotation number. Please try again." });
    }

    if (data.anonymousSessionId) {
      const submittedAt = new Date();
      await prisma.quotationAnalyticsSession.upsert({
        where: { anonymousSessionId: data.anonymousSessionId },
        create: {
          anonymousSessionId: data.anonymousSessionId,
          firstVisitedAt: submittedAt,
          lastActivityAt: submittedAt,
          startedAt: submittedAt,
          submittedAt,
          lastStep: 7,
          quotationId: quotation.id
        },
        update: { submittedAt, lastActivityAt: submittedAt, quotationId: quotation.id }
      });
      await prisma.quotationAnalyticsSession.updateMany({
        where: { anonymousSessionId: data.anonymousSessionId, startedAt: null },
        data: { startedAt: submittedAt }
      });
    }

    res.status(201).json(toQuotationPayload(quotation));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.get("/", async (_req, res, next) => {
  try {
    const quotations = await prisma.quotation.findMany({
      orderBy: { createdAt: "desc" },
      include: { invoices: { select: { id: true } }, extraCharges: { orderBy: { createdAt: "asc" } } }
    });
    res.json(quotations.map(toQuotationPayload));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.get("/:quotationNo", async (req, res, next) => {
  try {
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: req.params.quotationNo },
      include: { invoices: { select: { id: true } }, extraCharges: { orderBy: { createdAt: "asc" } }, statusHistory: { orderBy: { createdAt: "desc" } } }
    });
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    res.json(toQuotationPayload(quotation));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.post("/find", async (req, res, next) => {
  try {
    const { quotationNo, name, phone } = req.body;
    const normalizedQuotationNo = String(quotationNo ?? "").trim().toUpperCase();
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: normalizedQuotationNo },
      include: {
        customer: true,
        extraCharges: { orderBy: { createdAt: "asc" } },
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
    const quotation = await prisma.quotation.findUnique({
      where: { quotationNo: String(req.params.quotationNo).trim().toUpperCase() },
      include: { customer: true, invoices: { select: { id: true }, take: 1 }, extraCharges: { orderBy: { createdAt: "asc" } } }
    });
    if (!quotation || !customerIdentityMatches(quotation.customer, req.body, true)) {
      return res.status(404).json({ access: "NOT_FOUND" });
    }
    if (quotation.invoices.length > 0) {
      return res.status(409).json({ access: "INVOICE_STARTED" });
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
    const quotation = await prisma.quotation.update({
      where: { quotationNo: req.params.quotationNo },
      data: { status: "APPROVED" },
      include: { invoices: { select: { id: true } }, extraCharges: { orderBy: { createdAt: "asc" } } }
    });
    res.json(toQuotationPayload(quotation));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.delete("/:quotationNo", async (req, res, next) => {
  try {
    await prisma.quotation.delete({ where: { quotationNo: req.params.quotationNo } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
