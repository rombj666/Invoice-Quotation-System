import type { CustomizationDesign } from "../types/customization";

export type CustomizationTemplate = "cart" | "hotCup" | "coldCup";

type LayoutConfig = {
  designArea: { x: number; y: number; width: number; height: number };
  defaultCenter: { x: number; y: number };
  minWidthRatio: number;
  maxWidthRatio: number;
  paddingRatio: number;
};

export const CUSTOMIZATION_LAYOUT: Record<CustomizationTemplate, LayoutConfig> = {
  cart: {
    designArea: { x: 0.327, y: 0.435, width: 0.346, height: 0.34 },
    defaultCenter: { x: 0.5, y: 0.5 },
    minWidthRatio: 0.05,
    maxWidthRatio: 0.8,
    paddingRatio: 0.02
  },
  hotCup: {
    designArea: { x: 0.34, y: 0.47, width: 0.32, height: 0.22 },
    defaultCenter: { x: 0.5, y: 0.5 },
    minWidthRatio: 0.05,
    maxWidthRatio: 0.65,
    paddingRatio: 0.03
  },
  coldCup: {
    designArea: { x: 0.35, y: 0.35, width: 0.3, height: 0.28 },
    defaultCenter: { x: 0.5, y: 0.5 },
    minWidthRatio: 0.05,
    maxWidthRatio: 0.65,
    paddingRatio: 0.03
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
  const horizontalMaximum = 1 - config.paddingRatio * 2;
  const verticalMaximum = (config.designArea.height * (1 - config.paddingRatio * 2)) /
    (config.designArea.width * safeAspectRatio);
  const minimum = Math.min(config.minWidthRatio, horizontalMaximum, verticalMaximum);
  return {
    min: minimum,
    max: Math.max(minimum, Math.min(config.maxWidthRatio, horizontalMaximum, verticalMaximum))
  };
}

export function getCupWidthBounds(aspectRatio: number) {
  const hot = getContainedWidthBounds("hotCup", aspectRatio);
  const cold = getContainedWidthBounds("coldCup", aspectRatio);
  return { min: Math.max(hot.min, cold.min), max: Math.min(hot.max, cold.max) };
}

export function calculateContainedDesignRect(
  template: CustomizationTemplate,
  design: CustomizationDesign
): ContainedDesignRect {
  const config = CUSTOMIZATION_LAYOUT[template];
  const aspectRatio = designAspectRatio(design);
  const bounds = getContainedWidthBounds(template, aspectRatio);
  const widthRatio = clamp(getWidthRatio(design, template), bounds.min, bounds.max);
  const heightRatio = (config.designArea.width * widthRatio * aspectRatio) / config.designArea.height;
  const minimumX = config.paddingRatio + widthRatio / 2;
  const maximumX = 1 - config.paddingRatio - widthRatio / 2;
  const minimumY = config.paddingRatio + heightRatio / 2;
  const maximumY = 1 - config.paddingRatio - heightRatio / 2;
  const centerXRatio = clamp(
    design.centerXRatio ?? (Number.isFinite(design.x) ? design.x / 100 : config.defaultCenter.x),
    minimumX,
    maximumX
  );
  const centerYRatio = clamp(
    design.centerYRatio ?? (Number.isFinite(design.y) ? design.y / 100 : config.defaultCenter.y),
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
