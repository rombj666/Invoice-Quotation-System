import { Prisma, QuotationStatus } from "@prisma/client";
import { Router } from "express";
import { calculatePricing, getBaristasNeeded, getExtraBaristaFee, getServiceHoursExact } from "../utils/pricing";
import { prisma } from "../utils/prisma";
import { toInvoicePayload } from "../utils/invoice-payload";

export const quotationRoutes = Router();

const drinkNames: Record<string, string> = {
  americano: "Americano",
  latte: "Cafe Latte",
  chocolate: "Dark Chocolate",
  lemonade: "Lemonade"
};

function toQuotationPayload(record: any) {
  return {
    ...record.metadata,
    status: record.status
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
    const data = req.body;
    const pricing = calculatePricing(data);

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
      const quotationNo = await getNextQuotationNo();
      try {
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
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        metadata: toJsonValue({ ...data, quotationNo }),
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
          include: { customer: true }
        });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        throw error;
      }
    }

    if (!quotation) {
      return res.status(409).json({ error: "Unable to generate a unique quotation number. Please try again." });
    }

    res.status(201).json(toQuotationPayload(quotation));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.get("/", async (_req, res, next) => {
  try {
    const quotations = await prisma.quotation.findMany({ orderBy: { createdAt: "desc" } });
    res.json(quotations.map(toQuotationPayload));
  } catch (error) {
    next(error);
  }
});

quotationRoutes.get("/:quotationNo", async (req, res, next) => {
  try {
    const quotation = await prisma.quotation.findUnique({ where: { quotationNo: req.params.quotationNo } });
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
      include: { customer: true, invoices: { select: { id: true }, take: 1 } }
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
      data: { status: "APPROVED" }
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
