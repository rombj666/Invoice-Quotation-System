import { CUSTOMIZATION_LAYOUT, LATTE_PHYSICAL, MENU_PHYSICAL, CART_MAX_LOGO_SIZE_CM } from "./customization-layout";

export type PhysicalSize = {
  width?: number;
  height?: number;
  unit?: "cm" | "mm";
  diameterCm?: number;
  artworkWidthCm?: number;
  artworkHeightCm?: number;
  unavailable?: boolean;
};

export function customizationPhysicalSize(kind: string, key = ""): PhysicalSize {
  if (kind === "latteArt" || key === "latte-art") return { diameterCm: LATTE_PHYSICAL.printDiameterCm, artworkWidthCm: LATTE_PHYSICAL.artworkWidthCm, artworkHeightCm: LATTE_PHYSICAL.artworkHeightCm };
  if (kind === "customMenu") return MENU_PHYSICAL;
  if (kind === "cart" || kind === "CART_DESIGN") {
    const area = CUSTOMIZATION_LAYOUT.cart.physicalAreaCm!;
    return { ...area, unit: "cm", artworkWidthCm: CART_MAX_LOGO_SIZE_CM.width, artworkHeightCm: CART_MAX_LOGO_SIZE_CM.height };
  }
  if (kind === "sticker" || kind === "CUP_STICKER") {
    const area = CUSTOMIZATION_LAYOUT[key.includes(":hot") ? "hotCup" : "coldCup"].physicalAreaMm!;
    return { ...area, unit: "mm" };
  }
  // The sleeve customizer defines pixel/percentage placement only, no physical measurement.
  return { unavailable: true };
}

export function physicalSizeLabels(value: unknown, fallback: PhysicalSize): string[] {
  const size: Record<string, unknown> = { ...fallback, ...(value && typeof value === "object" ? value : {}) };
  const positive = (number: unknown): number is number => typeof number === "number" && Number.isFinite(number) && number > 0;
  const labels: string[] = [];
  if (positive(size.diameterCm)) labels.push(`Print Area: ${size.diameterCm} cm diameter`);
  if (positive(size.width) && positive(size.height) && (size.unit === "cm" || size.unit === "mm")) labels.push(`Design Area: ${size.width} × ${size.height} ${size.unit}`);
  if (positive(size.widthCm) && positive(size.heightCm)) labels.push(`Artwork Area: ${size.widthCm} × ${size.heightCm} cm`);
  if (positive(size.artworkWidthCm) && positive(size.artworkHeightCm)) labels.push(`Artwork Limit: ${size.artworkWidthCm} × ${size.artworkHeightCm} cm`);
  if (labels.length) return labels;
  if (value !== fallback) return physicalSizeLabels(fallback, fallback);
  return ["Physical size: not defined in the customizer configuration."];
}
