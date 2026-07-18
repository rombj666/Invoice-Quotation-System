type Addon = {
  name: string;
  price: number;
  [key: string]: unknown;
};

export const COFFEE_CART_PRICE = 50;
export const CUSTOM_BRANDED_CART_PRICE = 200;
export const CART_SELECTION_ERROR = "Coffee Cart and Custom Branded Cart cannot be selected together. Please keep only one cart option.";

export function hasCartAddonConflict(addons: Addon[] = []): boolean {
  const hasCoffeeCart = addons.some((addon) => addon.name === "Coffee Cart");
  const hasCustomBrandedCart = addons.some((addon) => addon.name === "Custom Branded Cart");
  return hasCoffeeCart && hasCustomBrandedCart;
}

export function getCanonicalAddonPrice(addon: Addon): number {
  if (addon.name === "Coffee Cart") return COFFEE_CART_PRICE;
  if (addon.name === "Custom Branded Cart") return CUSTOM_BRANDED_CART_PRICE;
  return addon.price;
}

export function normalizeCartAddonPrices(addons: Addon[] = []): Addon[] {
  return addons.map((addon) => ({ ...addon, price: getCanonicalAddonPrice(addon) }));
}

export function normalizeQuotationCartPrices<T extends { selectedAddons?: Addon[] }>(quotation: T): T & { selectedAddons: Addon[] } {
  return {
    ...quotation,
    selectedAddons: normalizeCartAddonPrices(quotation.selectedAddons ?? [])
  };
}

export function calculateSelectedAddonTotal(addons: Addon[] = []): number {
  let nonCartTotal = 0;
  let hasCoffeeCart = false;
  let hasCustomBrandedCart = false;

  for (const addon of addons) {
    if (addon.name === "Coffee Cart") {
      hasCoffeeCart = true;
    } else if (addon.name === "Custom Branded Cart") {
      hasCustomBrandedCart = true;
    } else {
      nonCartTotal += Number(addon.price) || 0;
    }
  }

  const cartTotal = hasCustomBrandedCart
    ? CUSTOM_BRANDED_CART_PRICE
    : hasCoffeeCart
      ? COFFEE_CART_PRICE
      : 0;
  return nonCartTotal + cartTotal;
}
