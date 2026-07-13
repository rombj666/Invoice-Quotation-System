export const CUSTOMIZATION_ASSETS = {
  cartTemplateUrl: "/assets/customization/cart-template.png",
  hotCupTemplateUrl: "/assets/customization/hot-cup-template.png",
  coldCupTemplateUrl: "/assets/customization/cold-cup-template.png",
  sleeveTemplateUrl: "/assets/customization/sleeve-template.png",
};

export const CART_DESIGN_PANEL = {
  left: 18,
  top: 17,
  width: 64,
  height: 64
} as const;

export function getCartLogoSizeBounds(aspectRatio: number) {
  const safeAspectRatio = Math.max(0.05, aspectRatio || 1);
  return {
    min: 8,
    max: Math.min(96, 96 / safeAspectRatio)
  };
}
