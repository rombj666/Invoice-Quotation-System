import { Prisma, QuotationStatus } from "@prisma/client";
import { Router } from "express";
import { calculatePricing, getBaristasNeeded, getExtraBaristaFee, getServiceHoursExact } from "../utils/pricing";
import { prisma } from "../utils/prisma";

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

    const customer = await prisma.customer.create({
      data: {
        name: data.customer.name,
        phone: data.customer.phone,
        email: data.customer.email,
        companyName: data.customer.companyName || null,
        companyRegNo: data.customer.companyRegNo || null,
        billingAddress: data.customer.billingAddress
      }
    });

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
    const quotation = await prisma.quotation.findUnique({ where: { quotationNo }, include: { customer: true } });
    if (!quotation) return res.status(404).json({ error: "Quotation not found" });
    const normalizedPhone = String(phone || "").replace(/\D/g, "");
    const customerPhone = quotation.customer.phone.replace(/\D/g, "");
    const nameMatches = quotation.customer.name.trim().toLowerCase() === String(name || "").trim().toLowerCase();
    if (!nameMatches || normalizedPhone !== customerPhone) return res.status(404).json({ error: "Quotation not found" });
    res.json(toQuotationPayload(quotation));
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
