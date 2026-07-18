import type { AddonPricingSnapshot, QuotationAddon } from "../types/quotation";
import type { AvailabilityItem } from "./product-availability";

export const FIXED_ADDON_DEFAULTS = {
  "Coffee Cart": 50,
  "Custom Branded Cart": 200,
  "Custom Menu": 30,
  "Custom Latte Art Stencil": 100
} as const;

export const DEFAULT_ADDON_PRICING: AddonPricingSnapshot = {
  cupSticker: {
    baseCupLimit: 100,
    basePrice: 50,
    additionalTierCups: 100,
    additionalTierPrice: 10
  },
  cupSleeve: {
    threshold: 150,
    rateBelowThreshold: 2,
    rateAtOrAboveThreshold: 1.5
  }
};

export const COFFEE_CART_ADDON_NAME = "Coffee Cart";
export const CUSTOM_BRANDED_CART_ADDON_NAME = "Custom Branded Cart";
export const CART_SELECTION_ERROR = "Coffee Cart and Custom Branded Cart cannot be selected together. Please keep only one cart option.";

export function getConfiguredFixedPrice(item: AvailabilityItem | undefined, fallback: number): number {
  return item?.pricingType === "FIXED" && typeof item.price === "number" ? item.price : fallback;
}

export function getConfiguredAddonPricing(items: Record<string, AvailabilityItem>): AddonPricingSnapshot {
  const sticker = items.custom_cup_stickers?.pricingConfig;
  const sleeve = items.custom_cup_sleeves?.pricingConfig;
  return {
    cupSticker: {
      baseCupLimit: sticker?.baseCupLimit ?? DEFAULT_ADDON_PRICING.cupSticker.baseCupLimit,
      basePrice: sticker?.basePrice ?? DEFAULT_ADDON_PRICING.cupSticker.basePrice,
      additionalTierCups: sticker?.additionalTierCups ?? DEFAULT_ADDON_PRICING.cupSticker.additionalTierCups,
      additionalTierPrice: sticker?.additionalTierPrice ?? DEFAULT_ADDON_PRICING.cupSticker.additionalTierPrice
    },
    cupSleeve: {
      threshold: sleeve?.threshold ?? DEFAULT_ADDON_PRICING.cupSleeve.threshold,
      rateBelowThreshold: sleeve?.rateBelowThreshold ?? DEFAULT_ADDON_PRICING.cupSleeve.rateBelowThreshold,
      rateAtOrAboveThreshold: sleeve?.rateAtOrAboveThreshold ?? DEFAULT_ADDON_PRICING.cupSleeve.rateAtOrAboveThreshold
    }
  };
}

export function isCoffeeCartSelected(addons: QuotationAddon[]): boolean {
  return addons.some((addon) => addon.name === COFFEE_CART_ADDON_NAME);
}

export function isCustomBrandedCartSelected(addons: QuotationAddon[]): boolean {
  return addons.some((addon) => addon.name === CUSTOM_BRANDED_CART_ADDON_NAME);
}

export function hasCartAddonConflict(addons: QuotationAddon[]): boolean {
  return isCoffeeCartSelected(addons) && isCustomBrandedCartSelected(addons);
}

export function calculateSelectedAddonTotal(addons: QuotationAddon[]): number {
  let nonCartTotal = 0;
  let coffeeCartPrice: number | null = null;
  let customBrandedCartPrice: number | null = null;

  for (const addon of addons) {
    if (addon.name === COFFEE_CART_ADDON_NAME) {
      coffeeCartPrice = Number(addon.price) || 0;
    } else if (addon.name === CUSTOM_BRANDED_CART_ADDON_NAME) {
      customBrandedCartPrice = Number(addon.price) || 0;
    } else {
      nonCartTotal += Number(addon.price) || 0;
    }
  }

  // Invalid legacy data may contain both. Count only the customized cart's
  // saved snapshot until the selection is corrected, never both cart prices.
  return nonCartTotal + (customBrandedCartPrice ?? coffeeCartPrice ?? 0);
}
