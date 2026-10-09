import type { CustomizationByDate } from "../types/customization";
import { CUSTOMIZATION_ASSETS } from "./customization-assets";
import { FOAM_BOARD_PHYSICAL_CM, normalizeDesignGeometry, normalizeFoamBoardDesign, renderContainedDesignToCanvas } from "./customization-layout";

export type CustomizationType = "cart" | "hot-cup" | "cold-cup" | "sleeve";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(src)) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Template image not found. Please add the image file in public/assets/customization."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/webp", quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to compress final customization preview."));
    }, type, quality);
  });
}

function canvasDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}

export async function renderFoamBoard(design: NonNullable<CustomizationByDate[string]>): Promise<NonNullable<CustomizationByDate[string]>> {
  const normalized = normalizeFoamBoardDesign(design);
  const image = await loadImage(normalized.originalDataUrl ?? normalized.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = Math.round(canvas.width * FOAM_BOARD_PHYSICAL_CM.height / FOAM_BOARD_PHYSICAL_CM.width);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to render foam board artwork.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  const width = normalized.widthCm! / FOAM_BOARD_PHYSICAL_CM.width * canvas.width;
  const height = normalized.heightCm! / FOAM_BOARD_PHYSICAL_CM.height * canvas.height;
  context.drawImage(image, normalized.centerXRatio! * canvas.width - width / 2, normalized.centerYRatio! * canvas.height - height / 2, width, height);
  return { ...normalized, originalDataUrl: normalized.originalDataUrl ?? normalized.dataUrl, finalDataUrl: canvasDataUrl(canvas), fileName: `final-foam-board-${design.fileName.replace(/\.[^.]+$/, "")}.png` };
}

export async function mergeCustomizationPreview(type: CustomizationType, design: NonNullable<CustomizationByDate[string]>): Promise<NonNullable<CustomizationByDate[string]>> {
  const templateUrl =
    type === "cart"
      ? CUSTOMIZATION_ASSETS.cartTemplateUrl
      : type === "hot-cup"
        ? CUSTOMIZATION_ASSETS.hotCupTemplateUrl
        : type === "cold-cup"
          ? CUSTOMIZATION_ASSETS.coldCupTemplateUrl
        : CUSTOMIZATION_ASSETS.sleeveTemplateUrl;
  const logoLayers = design.logos?.length ? design.logos : [design];
  const [templateImage, ...designImages] = await Promise.all([loadImage(templateUrl), ...logoLayers.map((logo) => loadImage(logo.originalDataUrl ?? logo.dataUrl))]);
  const canvas = document.createElement("canvas");
  const sourceWidth = templateImage.naturalWidth || 1000;
  const sourceHeight = templateImage.naturalHeight || 700;
  const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create final customization preview.");

  context.drawImage(templateImage, 0, 0, width, height);
  logoLayers.forEach((logo, index) => {
    const designImage = designImages[index];
    const ratio = designImage.naturalHeight / Math.max(1, designImage.naturalWidth);
    if (type !== "sleeve") {
      const template = type === "cart" ? "cart" : type === "hot-cup" ? "hotCup" : "coldCup";
      const normalized = normalizeDesignGeometry({ ...design, ...logo, aspectRatio: ratio, rotation: 0 }, template);
      renderContainedDesignToCanvas(context, designImage, width, height, template, normalized);
      return;
    }
    const targetWidth = width * logo.size * 0.01;
    const targetHeight = targetWidth * ratio;
    context.save();
    context.translate((logo.x / 100) * width, (logo.y / 100) * height);
    context.rotate((logo.rotation * Math.PI) / 180);
    context.drawImage(designImage, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
    context.restore();
  });
  const blob = await canvasToBlob(canvas);
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });

  return {
    ...design,
    originalDataUrl: design.originalDataUrl ?? design.dataUrl,
    dataUrl,
    fileName: `final-${type}-${design.fileName.replace(/\.[^.]+$/, "")}.webp`
  };
}
