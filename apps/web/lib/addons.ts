import type { AddonPricingSnapshot, QuotationAddon } from "../types/quotation";

export const FIXED_ADDON_DEFAULTS = {
  "Coffee Cart": 150,
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
export const CART_SELECTION_ERROR = "Standard Cart and Branded Cart cannot be selected together. Please keep only one cart option.";

export function isCoffeeCartSelected(addons: QuotationAddon[]): boolean {
  return addons.some((addon) => addon.name === COFFEE_CART_ADDON_NAME);
}

export function isCustomBrandedCartSelected(addons: QuotationAddon[]): boolean {
  return addons.some((addon) => addon.name === CUSTOM_BRANDED_CART_ADDON_NAME);
}

export function hasCartAddonConflict(addons: QuotationAddon[]): boolean {
  return isCoffeeCartSelected(addons) && isCustomBrandedCartSelected(addons);
}

export function getAddonDisplayName(name: string): string {
  if (name === COFFEE_CART_ADDON_NAME) return "Standard Cart (without customer logo)";
  if (name === CUSTOM_BRANDED_CART_ADDON_NAME) return "Branded Cart (with customer logo)";
  return name;
}

export function getAddonPrice(addon: QuotationAddon): number {
  if (addon.name === COFFEE_CART_ADDON_NAME) return FIXED_ADDON_DEFAULTS[COFFEE_CART_ADDON_NAME];
  if (addon.name === CUSTOM_BRANDED_CART_ADDON_NAME) return FIXED_ADDON_DEFAULTS[CUSTOM_BRANDED_CART_ADDON_NAME];
  return Number(addon.price) || 0;
}

export function calculateSelectedAddonTotal(addons: QuotationAddon[]): number {
  let nonCartTotal = 0;
  let coffeeCartPrice: number | null = null;
  let customBrandedCartPrice: number | null = null;

  for (const addon of addons) {
    if (addon.name === COFFEE_CART_ADDON_NAME) {
      coffeeCartPrice = getAddonPrice(addon);
    } else if (addon.name === CUSTOM_BRANDED_CART_ADDON_NAME) {
      customBrandedCartPrice = getAddonPrice(addon);
    } else {
      nonCartTotal += getAddonPrice(addon);
    }
  }

  // Invalid legacy data may contain both. Count only the customized cart's
  // saved snapshot until the selection is corrected, never both cart prices.
  return nonCartTotal + (customBrandedCartPrice ?? coffeeCartPrice ?? 0);
}
