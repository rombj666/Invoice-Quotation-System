import type { CustomizationDesign } from "../types/customization";

export type CustomizationTemplate = "cart" | "hotCup" | "coldCup";

type LayoutConfig = {
  designArea: { x: number; y: number; width: number; height: number };
  templateSizePx: { width: number; height: number };
  defaultCenter: { x: number; y: number };
  minWidthRatio: number;
  paddingRatio: number;
  physicalAreaCm?: { width: number; height: number };
  maxLogoSizeCm?: { width: number; height: number };
  physicalAreaMm?: { width: number; height: number };
  maxLogoSizeMm?: { width: number; height: number };
};

export const CART_MAX_LOGO_SIZE_CM = { width: 90, height: 70 };
export const CUP_MAX_LOGO_SIZE_MM = { width: 30, height: 45 };

const CUP_DISPLAY_MAX_LOGO_SIZE_MM = 50;

const CART_PHYSICAL_AREA_CM = { width: 90, height: 90 };
const CUP_PRINTABLE_AREA_MM = { width: 30, height: 45 };

export const CUSTOMIZATION_LAYOUT: Record<CustomizationTemplate, LayoutConfig> = {
  cart: {
    designArea: { x: 0.327, y: 0.435, width: 0.346, height: 0.34 },
    templateSizePx: { width: 1536, height: 1024 },
    defaultCenter: { x: 0.5, y: 0.5 },
    minWidthRatio: 0.05,
    paddingRatio: 0.02,
    physicalAreaCm: CART_PHYSICAL_AREA_CM,
    maxLogoSizeCm: CART_MAX_LOGO_SIZE_CM
  },
  hotCup: {
    designArea: { x: 0.34, y: 0.47, width: 0.32, height: 0.22 },
    templateSizePx: { width: 1024, height: 1536 },
    defaultCenter: { x: 0.5, y: 0.5 },
    minWidthRatio: 0.05,
    paddingRatio: 0.03,
    physicalAreaMm: CUP_PRINTABLE_AREA_MM,
    maxLogoSizeMm: CUP_MAX_LOGO_SIZE_MM
  },
  coldCup: {
    designArea: { x: 0.35, y: 0.35, width: 0.3, height: 0.28 },
    templateSizePx: { width: 1024, height: 1536 },
    defaultCenter: { x: 0.5, y: 0.55 },
    minWidthRatio: 0.05,
    paddingRatio: 0.03,
    physicalAreaMm: CUP_PRINTABLE_AREA_MM,
    maxLogoSizeMm: CUP_MAX_LOGO_SIZE_MM
  }
};

export const SHOW_CUSTOMIZATION_BOUNDARIES =
  process.env.NODE_ENV === "development" && false;

export type ContainedDesignRect = {
  centerXRatio: number;
  centerYRatio: number;
  widthRatio: number;
  heightRatio: number;
  templateX: number;
  templateY: number;
  templateWidth: number;
  templateHeight: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export function designAspectRatio(design: Pick<CustomizationDesign, "aspectRatio">): number {
  return Math.max(0.05, design.aspectRatio || 1);
}

export function getWidthRatio(design: CustomizationDesign, template: CustomizationTemplate): number {
  if (template === "hotCup") return design.hotWidthRatio ?? design.widthRatio ?? design.size / 100;
  if (template === "coldCup") return design.coldWidthRatio ?? design.widthRatio ?? design.size / 100;
  return design.widthRatio ?? design.size / 100;
}

export function getContainedWidthBounds(template: CustomizationTemplate, aspectRatio: number) {
  const config = CUSTOMIZATION_LAYOUT[template];
  const safeAspectRatio = Math.max(0.05, aspectRatio || 1);
  const printableAreaPixelAspectRatio =
    (config.designArea.width * config.templateSizePx.width) /
    (config.designArea.height * config.templateSizePx.height);
  const horizontalMaximum = 1 - config.paddingRatio * 2;
  const verticalMaximum = (1 - config.paddingRatio * 2) /
    (printableAreaPixelAspectRatio * safeAspectRatio);
  const physicalArea = config.physicalAreaCm ?? config.physicalAreaMm;
  const maximumLogoSize = config.maxLogoSizeCm ?? config.maxLogoSizeMm;
  const physicalWidthMaximum = physicalArea && maximumLogoSize
    ? maximumLogoSize.width / physicalArea.width
    : horizontalMaximum;
  const physicalHeightMaximum = physicalArea && maximumLogoSize
    ? (maximumLogoSize.height / physicalArea.height) *
      (1 / (printableAreaPixelAspectRatio * safeAspectRatio))
    : verticalMaximum;
  const effectiveMaximum = Math.min(
    physicalWidthMaximum,
    physicalHeightMaximum,
    horizontalMaximum,
    verticalMaximum
  );
  const minimum = Math.min(config.minWidthRatio, effectiveMaximum);
  return {
    min: minimum,
    max: Math.max(minimum, effectiveMaximum)
  };
}

export function getCupWidthBounds(aspectRatio: number) {
  const hot = getContainedWidthBounds("hotCup", aspectRatio);
  const cold = getContainedWidthBounds("coldCup", aspectRatio);
  return { min: Math.max(hot.min, cold.min), max: Math.min(hot.max, cold.max) };
}

export function getCupLogoSizeMm(design: CustomizationDesign) {
  const aspectRatio = designAspectRatio(design);
  const bounds = getCupWidthBounds(aspectRatio);
  const requestedWidthRatio = design.widthRatio ?? design.size / 100;
  const commonWidthRatio = clamp(requestedWidthRatio, bounds.min, bounds.max);
  const commonDesign = {
    ...design,
    widthRatio: commonWidthRatio,
    hotWidthRatio: commonWidthRatio,
    coldWidthRatio: commonWidthRatio
  };
  const hotRect = calculateContainedDesignRect("hotCup", commonDesign);
  const coldRect = calculateContainedDesignRect("coldCup", commonDesign);
  const resolvedWidthRatio = Math.min(hotRect.widthRatio, coldRect.widthRatio);
  const widthAtMaximum = CUP_DISPLAY_MAX_LOGO_SIZE_MM / Math.max(1, aspectRatio);
  const width = (resolvedWidthRatio / bounds.max) * widthAtMaximum;

  return { width, height: width * aspectRatio };
}

export function calculateContainedDesignRect(
  template: CustomizationTemplate,
  design: CustomizationDesign
): ContainedDesignRect {
  const config = CUSTOMIZATION_LAYOUT[template];
  const aspectRatio = designAspectRatio(design);
  const bounds = getContainedWidthBounds(template, aspectRatio);
  const widthRatio = clamp(getWidthRatio(design, template), bounds.min, bounds.max);
  const printableAreaPixelAspectRatio =
    (config.designArea.width * config.templateSizePx.width) /
    (config.designArea.height * config.templateSizePx.height);
  const heightRatio = printableAreaPixelAspectRatio * widthRatio * aspectRatio;
  const minimumX = config.paddingRatio + widthRatio / 2;
  const maximumX = 1 - config.paddingRatio - widthRatio / 2;
  const minimumY = config.paddingRatio + heightRatio / 2;
  const maximumY = 1 - config.paddingRatio - heightRatio / 2;
  const isCup = template === "hotCup" || template === "coldCup";
  const centerXRatio = clamp(
    isCup
      ? config.defaultCenter.x
      : design.centerXRatio ?? (Number.isFinite(design.x) ? design.x / 100 : config.defaultCenter.x),
    minimumX,
    maximumX
  );
  const centerYRatio = clamp(
    isCup
      ? config.defaultCenter.y
      : design.centerYRatio ?? (Number.isFinite(design.y) ? design.y / 100 : config.defaultCenter.y),
    minimumY,
    maximumY
  );

  return {
    centerXRatio,
    centerYRatio,
    widthRatio,
    heightRatio,
    templateX: config.designArea.x + (centerXRatio - widthRatio / 2) * config.designArea.width,
    templateY: config.designArea.y + (centerYRatio - heightRatio / 2) * config.designArea.height,
    templateWidth: widthRatio * config.designArea.width,
    templateHeight: heightRatio * config.designArea.height
  };
}

export function normalizeDesignGeometry(
  design: CustomizationDesign,
  template: CustomizationTemplate
): CustomizationDesign {
  const rect = calculateContainedDesignRect(template, design);
  const isCup = template === "hotCup" || template === "coldCup";
  return {
    ...design,
    size: rect.widthRatio * 100,
    rotation: isCup ? 0 : design.rotation,
    x: rect.centerXRatio * 100,
    y: rect.centerYRatio * 100,
    centerXRatio: rect.centerXRatio,
    centerYRatio: rect.centerYRatio,
    widthRatio: rect.widthRatio,
    ...(template === "hotCup" ? { hotWidthRatio: rect.widthRatio } : {}),
    ...(template === "coldCup" ? { coldWidthRatio: rect.widthRatio } : {}),
    widthPercent: rect.widthRatio * 100,
    heightPercent: rect.heightRatio * 100
  };
}

export function createDefaultDesignGeometry(
  design: CustomizationDesign,
  template: CustomizationTemplate,
  requestedWidthRatio: number
): CustomizationDesign {
  const config = CUSTOMIZATION_LAYOUT[template];
  return normalizeDesignGeometry({
    ...design,
    size: requestedWidthRatio * 100,
    rotation: template === "cart" ? design.rotation : 0,
    x: config.defaultCenter.x * 100,
    y: config.defaultCenter.y * 100,
    centerXRatio: config.defaultCenter.x,
    centerYRatio: config.defaultCenter.y,
    widthRatio: requestedWidthRatio,
    ...(template === "hotCup" ? { hotWidthRatio: requestedWidthRatio } : {}),
    ...(template === "coldCup" ? { coldWidthRatio: requestedWidthRatio } : {})
  }, template);
}

export function renderContainedDesignToCanvas(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  canvasWidth: number,
  canvasHeight: number,
  template: CustomizationTemplate,
  design: CustomizationDesign
) {
  const rect = calculateContainedDesignRect(template, design);
  context.drawImage(
    image,
    rect.templateX * canvasWidth,
    rect.templateY * canvasHeight,
    rect.templateWidth * canvasWidth,
    rect.templateHeight * canvasHeight
  );
}

export function formatCustomizationDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}
