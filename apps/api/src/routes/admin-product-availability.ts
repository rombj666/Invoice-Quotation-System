import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../utils/prisma";
import { ensureProductAvailabilityDefaults, serializeProductAvailability } from "../utils/product-availability";

export const adminProductAvailabilityRoutes = Router();

function groupItems(items: any[]) {
  return items.reduce<Record<string, any[]>>((groups, item) => {
    const serialized = serializeProductAvailability(item);
    groups[item.category] = [...(groups[item.category] ?? []), serialized];
    return groups;
  }, {});
}

function validCurrency(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && Number(value.toFixed(2)) === value;
}

function validPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function validatePricingConfig(pricingType: string | null, value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const config = value as Record<string, unknown>;
  if (pricingType === "STICKER_TIERS") {
    if (!validPositiveInteger(config.baseCupLimit) || !validCurrency(config.basePrice) || !validPositiveInteger(config.additionalTierCups) || !validCurrency(config.additionalTierPrice)) return null;
    return {
      baseCupLimit: config.baseCupLimit,
      basePrice: config.basePrice,
      additionalTierCups: config.additionalTierCups,
      additionalTierPrice: config.additionalTierPrice
    };
  }
  if (pricingType === "SLEEVE_RATES") {
    if (!validPositiveInteger(config.threshold) || !validCurrency(config.rateBelowThreshold) || !validCurrency(config.rateAtOrAboveThreshold)) return null;
    return {
      threshold: config.threshold,
      rateBelowThreshold: config.rateBelowThreshold,
      rateAtOrAboveThreshold: config.rateAtOrAboveThreshold
    };
  }
  return null;
}

adminProductAvailabilityRoutes.get("/", async (_req, res, next) => {
  try {
    await ensureProductAvailabilityDefaults();
    const items = await prisma.productAvailability.findMany({ orderBy: [{ category: "asc" }, { itemName: "asc" }] });
    res.json(groupItems(items));
  } catch (error) {
    next(error);
  }
});

adminProductAvailabilityRoutes.patch("/:itemKey", async (req, res, next) => {
  try {
    await ensureProductAvailabilityDefaults();
    const current = await prisma.productAvailability.findUnique({ where: { itemKey: req.params.itemKey } });
    if (!current) return res.status(404).json({ error: "Product item not found." });

    const data: Prisma.ProductAvailabilityUpdateInput = {};
    if ("isAvailable" in req.body) {
      if (typeof req.body.isAvailable !== "boolean") return res.status(400).json({ error: "Availability must be true or false." });
      data.isAvailable = req.body.isAvailable;
    }

    if ("price" in req.body || "pricingConfig" in req.body) {
      if (current.category !== "Add-on Features" || current.pricingType === "FREE") {
        return res.status(400).json({ error: "Pricing cannot be edited for this item." });
      }
      if (current.itemKey === "coffee_cart" || current.itemKey === "custom_branded_cart") {
        return res.status(400).json({ error: "Cart pricing is fixed and cannot be edited." });
      }
      if (current.pricingType === "FIXED") {
        if (!("price" in req.body) || !validCurrency(req.body.price)) return res.status(400).json({ error: "Enter a valid non-negative price with no more than 2 decimal places." });
        data.price = req.body.price;
      } else {
        const config = validatePricingConfig(current.pricingType, req.body.pricingConfig);
        if (!config) return res.status(400).json({ error: "Enter valid non-negative rates and positive whole-number thresholds." });
        data.pricingConfig = config as Prisma.InputJsonValue;
      }
    }

    if (!Object.keys(data).length) return res.status(400).json({ error: "No supported update was provided." });
    const item = await prisma.productAvailability.update({ where: { itemKey: req.params.itemKey }, data });
    res.json(serializeProductAvailability(item));
  } catch (error) {
    next(error);
  }
});
