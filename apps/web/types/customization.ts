export type CustomizationDesign = {
  fileName: string;
  dataUrl: string;
  originalDataUrl?: string;
  size: number;
  rotation: number;
  x: number;
  y: number;
  aspectRatio?: number;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
  widthCm?: number;
  heightCm?: number;
};

export type CustomizationByDate = Record<string, CustomizationDesign | undefined>;
