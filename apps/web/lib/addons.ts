import type { QuotationAddon } from "../types/quotation";

export const COFFEE_CART_ADDON: QuotationAddon = { name: "Coffee Cart", price: 50 };
export const CUSTOM_BRANDED_CART_ADDON: QuotationAddon = { name: "Custom Branded Cart", price: 200 };
export const CART_SELECTION_ERROR = "Coffee Cart and Custom Branded Cart cannot be selected together. Please keep only one cart option.";

export function isCoffeeCartSelected(addons: QuotationAddon[]): boolean {
  return addons.some((addon) => addon.name === COFFEE_CART_ADDON.name);
}

export function isCustomBrandedCartSelected(addons: QuotationAddon[]): boolean {
  return addons.some((addon) => addon.name === CUSTOM_BRANDED_CART_ADDON.name);
}

export function hasCartAddonConflict(addons: QuotationAddon[]): boolean {
  return isCoffeeCartSelected(addons) && isCustomBrandedCartSelected(addons);
}

export function getCanonicalAddonPrice(addon: QuotationAddon): number {
  if (addon.name === COFFEE_CART_ADDON.name) return COFFEE_CART_ADDON.price;
  if (addon.name === CUSTOM_BRANDED_CART_ADDON.name) return CUSTOM_BRANDED_CART_ADDON.price;
  return addon.price;
}

export function normalizeCartAddonPrices(addons: QuotationAddon[]): QuotationAddon[] {
  return addons.map((addon) => ({ ...addon, price: getCanonicalAddonPrice(addon) }));
}

export function calculateSelectedAddonTotal(addons: QuotationAddon[]): number {
  let nonCartTotal = 0;
  let hasCoffeeCart = false;
  let hasCustomBrandedCart = false;

  for (const addon of addons) {
    if (addon.name === COFFEE_CART_ADDON.name) {
      hasCoffeeCart = true;
    } else if (addon.name === CUSTOM_BRANDED_CART_ADDON.name) {
      hasCustomBrandedCart = true;
    } else {
      nonCartTotal += addon.price;
    }
  }

  // Invalid legacy data may contain both. Charge only the customized cart until
  // the selection is corrected, never both cart prices together.
  const cartTotal = hasCustomBrandedCart
    ? CUSTOM_BRANDED_CART_ADDON.price
    : hasCoffeeCart
      ? COFFEE_CART_ADDON.price
      : 0;
  return nonCartTotal + cartTotal;
}
