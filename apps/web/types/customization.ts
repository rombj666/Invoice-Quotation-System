export type CustomizationLogo = {
  id: string;
  fileName: string;
  dataUrl: string;
  originalDataUrl?: string;
  size: number;
  rotation: number;
  x: number;
  y: number;
  aspectRatio?: number;
};

export type CustomizationDesign = {
  fileName: string;
  dataUrl: string;
  originalDataUrl?: string;
  size: number;
  rotation: number;
  x: number;
  y: number;
  aspectRatio?: number;
  centerXRatio?: number;
  centerYRatio?: number;
  widthRatio?: number;
  hotWidthRatio?: number;
  coldWidthRatio?: number;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  heightPercent?: number;
  widthCm?: number;
  heightCm?: number;
  logos?: CustomizationLogo[];
};

export type CustomizationByDate = Record<string, CustomizationDesign | undefined>;
