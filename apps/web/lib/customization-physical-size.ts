import { CART_FRONT_PANEL_CM, CUSTOMIZATION_LAYOUT, FOAM_BOARD_MAX_ARTWORK_CM, FOAM_BOARD_PHYSICAL_CM, LATTE_PHYSICAL, MENU_PHYSICAL } from "./customization-layout";

export type PhysicalSize = {
  width?: number;
  height?: number;
  unit?: "cm" | "mm";
  diameterCm?: number;
  artworkWidthCm?: number;
  artworkHeightCm?: number;
  actualArtworkSizeCm?: { width: number; height: number };
  actualArtworkSizeMm?: { width: number; height: number };
  unavailable?: boolean;
};

export function customizationPhysicalSize(kind: string, key = ""): PhysicalSize {
  if (kind === "latteArt" || key === "latte-art") return { diameterCm: LATTE_PHYSICAL.printDiameterCm, artworkWidthCm: LATTE_PHYSICAL.artworkWidthCm, artworkHeightCm: LATTE_PHYSICAL.artworkHeightCm };
  if (kind === "customMenu") return MENU_PHYSICAL;
  if (kind === "cart" || kind === "CART_DESIGN") {
    return { ...CART_FRONT_PANEL_CM, unit: "cm", artworkWidthCm: CART_FRONT_PANEL_CM.width, artworkHeightCm: CART_FRONT_PANEL_CM.height };
  }
  if (kind === "foamBoard" || kind === "FOAM_BOARD") return { ...FOAM_BOARD_PHYSICAL_CM, unit: "cm", artworkWidthCm: FOAM_BOARD_MAX_ARTWORK_CM.width, artworkHeightCm: FOAM_BOARD_MAX_ARTWORK_CM.height };
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
  if (size.actualArtworkSizeCm && typeof size.actualArtworkSizeCm === "object") {
    const artwork = size.actualArtworkSizeCm as Record<string, unknown>;
    if (positive(artwork.width) && positive(artwork.height)) labels.push(`Physical Artwork: ${artwork.width.toFixed(1)} × ${artwork.height.toFixed(1)} cm`);
  }
  if (size.actualArtworkSizeMm && typeof size.actualArtworkSizeMm === "object") {
    const artwork = size.actualArtworkSizeMm as Record<string, unknown>;
    if (positive(artwork.width) && positive(artwork.height)) labels.push(`Physical Artwork: ${artwork.width.toFixed(1)} × ${artwork.height.toFixed(1)} mm`);
  }
  if (labels.length) return labels;
  if (value !== fallback) return physicalSizeLabels(fallback, fallback);
  return ["Physical size: not defined in the customizer configuration."];
}
