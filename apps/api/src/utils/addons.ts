type Addon = {
  name: string;
  price: number;
  [key: string]: unknown;
};

export type CupStickerPricingConfig = {
  baseCupLimit: number;
  basePrice: number;
  additionalTierCups: number;
  additionalTierPrice: number;
};

export type CupSleevePricingConfig = {
  threshold: number;
  rateBelowThreshold: number;
  rateAtOrAboveThreshold: number;
};

export const DEFAULT_STICKER_PRICING: CupStickerPricingConfig = {
  baseCupLimit: 100,
  basePrice: 50,
  additionalTierCups: 100,
  additionalTierPrice: 10
};

export const DEFAULT_SLEEVE_PRICING: CupSleevePricingConfig = {
  threshold: 150,
  rateBelowThreshold: 2,
  rateAtOrAboveThreshold: 1.5
};

export const FIXED_CART_PRICES = {
  "Coffee Cart": 150,
  "Custom Branded Cart": 200
} as const;

export const CART_SELECTION_ERROR = "Standard Cart and Branded Cart cannot be selected together. Please keep only one cart option.";

export function hasCartAddonConflict(addons: Addon[] = []): boolean {
  const hasCoffeeCart = addons.some((addon) => addon.name === "Coffee Cart");
  const hasCustomBrandedCart = addons.some((addon) => addon.name === "Custom Branded Cart");
  return hasCoffeeCart && hasCustomBrandedCart;
}

export function calculateSelectedAddonTotal(addons: Addon[] = []): number {
  let nonCartTotal = 0;
  let coffeeCartPrice: number | null = null;
  let customBrandedCartPrice: number | null = null;

  for (const addon of addons) {
    if (addon.name === "Coffee Cart") {
      coffeeCartPrice = FIXED_CART_PRICES["Coffee Cart"];
    } else if (addon.name === "Custom Branded Cart") {
      customBrandedCartPrice = FIXED_CART_PRICES["Custom Branded Cart"];
    } else {
      nonCartTotal += Number(addon.price) || 0;
    }
  }

  return nonCartTotal + (customBrandedCartPrice ?? coffeeCartPrice ?? 0);
}
