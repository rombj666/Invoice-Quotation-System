import type { CustomizationByDate } from "../types/customization";
import { CUSTOMIZATION_ASSETS } from "./customization-assets";
import { normalizeDesignGeometry, renderContainedDesignToCanvas } from "./customization-layout";

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

