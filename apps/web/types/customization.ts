export type CustomizationDesign = {
  fileName: string;
  dataUrl: string;
  size: number;
  rotation: number;
  x: number;
  y: number;
};

export type CustomizationByDate = Record<string, CustomizationDesign | undefined>;
