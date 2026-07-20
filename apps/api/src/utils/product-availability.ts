import { Prisma } from "@prisma/client";
import { DEFAULT_SLEEVE_PRICING, DEFAULT_STICKER_PRICING, FIXED_CART_PRICES } from "./addons";
import { prisma } from "./prisma";

export type ProductPricingType = "FREE" | "FIXED" | "STICKER_TIERS" | "SLEEVE_RATES";

type DefaultProductItem = {
  category: "Beverages" | "Add-on Features";
  itemKey: string;
  itemName: string;
  pricingType: ProductPricingType | null;
  price: number | null;
  pricingConfig: Record<string, number> | null;
};

export const defaultProductItems: DefaultProductItem[] = [
  { category: "Beverages", itemKey: "americano", itemName: "Americano", pricingType: null, price: null, pricingConfig: null },
  { category: "Beverages", itemKey: "cafe_latte", itemName: "Cafe Latte", pricingType: null, price: null, pricingConfig: null },
  { category: "Beverages", itemKey: "dark_chocolate", itemName: "Dark Chocolate", pricingType: null, price: null, pricingConfig: null },
  { category: "Beverages", itemKey: "lemonade", itemName: "Lemonade", pricingType: null, price: null, pricingConfig: null },
  { category: "Add-on Features", itemKey: "smart_qr_ordering_system", itemName: "Smart QR Ordering System", pricingType: "FREE", price: 0, pricingConfig: null },
  { category: "Add-on Features", itemKey: "premium_table_setup", itemName: "Premium Table Setup", pricingType: "FREE", price: 0, pricingConfig: null },
  { category: "Add-on Features", itemKey: "coffee_cart", itemName: "Standard Cart (without customer logo)", pricingType: "FIXED", price: FIXED_CART_PRICES["Coffee Cart"], pricingConfig: null },
  { category: "Add-on Features", itemKey: "custom_branded_cart", itemName: "Branded Cart (with customer logo)", pricingType: "FIXED", price: FIXED_CART_PRICES["Custom Branded Cart"], pricingConfig: null },
  { category: "Add-on Features", itemKey: "custom_cup_stickers", itemName: "Custom Cup Stickers", pricingType: "STICKER_TIERS", price: null, pricingConfig: DEFAULT_STICKER_PRICING },
  { category: "Add-on Features", itemKey: "custom_cup_sleeves", itemName: "Custom Cup Sleeves", pricingType: "SLEEVE_RATES", price: null, pricingConfig: DEFAULT_SLEEVE_PRICING },
  { category: "Add-on Features", itemKey: "custom_menu", itemName: "Custom Menu", pricingType: "FIXED", price: 30, pricingConfig: null },
  { category: "Add-on Features", itemKey: "custom_latte_art_stencil", itemName: "Custom Latte Art Stencil", pricingType: "FIXED", price: 100, pricingConfig: null }
];

function jsonValue(value: Record<string, number> | null): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value ? value as Prisma.InputJsonValue : Prisma.JsonNull;
}

export async function ensureProductAvailabilityDefaults() {
  await Promise.all(defaultProductItems.map((item) => prisma.productAvailability.upsert({
    where: { itemKey: item.itemKey },
    update: { category: item.category, itemName: item.itemName },
    create: {
      category: item.category,
      itemKey: item.itemKey,
      itemName: item.itemName,
      isAvailable: true,
      pricingType: item.pricingType,
      price: item.price,
      pricingConfig: jsonValue(item.pricingConfig)
    }
  })));

  await Promise.all(defaultProductItems.filter((item) => item.pricingType).map((item) => prisma.productAvailability.updateMany({
    where: { itemKey: item.itemKey, pricingType: null },
    data: {
      pricingType: item.pricingType,
      price: item.price,
      pricingConfig: jsonValue(item.pricingConfig)
    }
  })));

  await Promise.all([
    prisma.productAvailability.updateMany({
      where: { itemKey: "coffee_cart", price: { not: FIXED_CART_PRICES["Coffee Cart"] } },
      data: { price: FIXED_CART_PRICES["Coffee Cart"] }
    }),
    prisma.productAvailability.updateMany({
      where: { itemKey: "custom_branded_cart", price: { not: FIXED_CART_PRICES["Custom Branded Cart"] } },
      data: { price: FIXED_CART_PRICES["Custom Branded Cart"] }
    })
  ]);
}

export function serializeProductAvailability(item: any) {
  return {
    ...item,
    price: item.price === null || item.price === undefined ? null : Number(item.price),
    pricingConfig: item.pricingConfig && typeof item.pricingConfig === "object" ? item.pricingConfig : null
  };
}

export function applyCurrentProductPricing<T extends { selectedAddons?: Array<{ name: string; price: number }>; addonPricing?: unknown }>(quotation: T, items: any[]): T {
  const byKey = Object.fromEntries(items.map((item) => [item.itemKey, serializeProductAvailability(item)]));
  const fixedKeys: Record<string, string> = {
    "Coffee Cart": "coffee_cart",
    "Custom Branded Cart": "custom_branded_cart",
    "Custom Menu": "custom_menu",
    "Custom Latte Art Stencil": "custom_latte_art_stencil"
  };
  const selectedAddons = (quotation.selectedAddons ?? []).map((addon) => {
    if (addon.name === "Coffee Cart" || addon.name === "Custom Branded Cart") {
      return { ...addon, price: FIXED_CART_PRICES[addon.name] };
    }
    const configured = byKey[fixedKeys[addon.name]];
    return configured?.pricingType === "FIXED" && typeof configured.price === "number"
      ? { ...addon, price: configured.price }
      : addon;
  });
  const sticker = byKey.custom_cup_stickers?.pricingConfig ?? DEFAULT_STICKER_PRICING;
  const sleeve = byKey.custom_cup_sleeves?.pricingConfig ?? DEFAULT_SLEEVE_PRICING;
  return {
    ...quotation,
    selectedAddons,
    addonPricing: {
      cupSticker: {
        baseCupLimit: Number(sticker.baseCupLimit),
        basePrice: Number(sticker.basePrice),
        additionalTierCups: Number(sticker.additionalTierCups),
        additionalTierPrice: Number(sticker.additionalTierPrice)
      },
      cupSleeve: {
        threshold: Number(sleeve.threshold),
        rateBelowThreshold: Number(sleeve.rateBelowThreshold),
        rateAtOrAboveThreshold: Number(sleeve.rateAtOrAboveThreshold)
      }
    }
  };
}
