import { customizationPhysicalSize, type PhysicalSize } from "./customization-physical-size";
import { mergeCustomizationPreview, renderFoamBoard } from "./customization-renderer";
import { getCupLogoSizeMm, normalizeDesignGeometry } from "./customization-layout";
import type { CustomizationByDate, CustomizationDesign, CustomizationLogo } from "../types/customization";
import type { InvoiceDetails, InvoiceUploadFile } from "../types/invoice";
import { apiBaseUrl } from "./api-client";

async function response<T>(request: Promise<Response>): Promise<T> {
  const result = await request;
  const payload = await result.json().catch(() => null);
  if (!result.ok) throw new Error(payload?.error ?? "Request failed.");
  return payload as T;
}

export function loadCustomization(token: string) {
  return response<InvoiceDetails>(fetch(`${apiBaseUrl}/api/invoices/customization/${encodeURIComponent(token)}`));
}

function dataUrlBlob(dataUrl: string) {
  const [header, body] = dataUrl.split(",");
  const bytes = Uint8Array.from(atob(body), (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: header.match(/^data:(.*?);/)?.[1] ?? "application/octet-stream" });
}

export type CustomizationSubmission = {
  acknowledgements: boolean[];
  eventAddress: string; dressCode: string; customDressCode: string; environment: string; environmentNotes: string;
  cartDesigns: CustomizationByDate; sleeveDesigns: CustomizationByDate; stickerDesigns: CustomizationByDate; foamBoardDesigns?: CustomizationByDate; customMenu?: InvoiceUploadFile; latteArt?: InvoiceUploadFile;
};

export async function submitCustomization(token: string, data: CustomizationSubmission) {
  const form = new FormData();
  const physicalSizes: Record<string, PhysicalSize> = {};
  const designMetadata: Record<string, Record<string, unknown>> = {};
  const stripData = (value: CustomizationDesign | CustomizationLogo) => {
    const result = { ...value } as Record<string, unknown>;
    delete result.dataUrl; delete result.originalDataUrl; delete result.finalDataUrl;
    if (Array.isArray(result.logos)) result.logos = result.logos.map((logo) => stripData(logo as CustomizationLogo));
    return result;
  };
  const appendDesigns = async (prefix: "cart" | "sleeve" | "sticker", designs: CustomizationByDate) => Promise.all(Object.entries(designs).map(async ([key, design]) => {
    if (!design) return;
    const layers = design.logos?.length ? design.logos : [design];
    layers.forEach((layer, index) => {
      const field = `${prefix}:${key}:${index}`;
      form.append(field, dataUrlBlob(layer.originalDataUrl ?? layer.dataUrl), layer.fileName);
      designMetadata[field] = stripData(layer);
      const size = customizationPhysicalSize(prefix, key);
      if (prefix === "cart") {
        const cartDesign = normalizeDesignGeometry(design, "cart");
        size.actualArtworkSizeCm = { width: cartDesign.widthCm ?? 0, height: cartDesign.heightCm ?? 0 };
      } else if (prefix === "sticker") {
        const logo = getCupLogoSizeMm(design);
        size.actualArtworkSizeMm = logo;
      }
      physicalSizes[field] = size;
    });
    if (prefix === "sticker") {
      const hot = await mergeCustomizationPreview("hot-cup", design);
      const cold = await mergeCustomizationPreview("cold-cup", design);
      const hotField = `${prefix}:final:${key}:hot`;
      const coldField = `${prefix}:final:${key}:cold`;
      form.append(hotField, dataUrlBlob(hot.dataUrl), hot.fileName);
      form.append(coldField, dataUrlBlob(cold.dataUrl), cold.fileName);
      physicalSizes[hotField] = physicalSizes[`${prefix}:${key}:0`] ?? customizationPhysicalSize(prefix, key);
      physicalSizes[coldField] = physicalSizes[hotField];
      designMetadata[hotField] = stripData(design); designMetadata[coldField] = stripData(design);
    } else {
      const final = await mergeCustomizationPreview(prefix === "cart" ? "cart" : "sleeve", design);
      const finalField = `${prefix}:final:${key}`;
      form.append(finalField, dataUrlBlob(final.dataUrl), final.fileName);
      physicalSizes[finalField] = physicalSizes[`${prefix}:${key}:0`] ?? customizationPhysicalSize(prefix, key);
      designMetadata[finalField] = stripData(design);
    }
  }));
  await Promise.all([appendDesigns("cart", data.cartDesigns), appendDesigns("sleeve", data.sleeveDesigns), appendDesigns("sticker", data.stickerDesigns)]);

  for (const [key, design] of Object.entries(data.foamBoardDesigns ?? {})) {
    if (!design) continue;
    const rendered = await renderFoamBoard(design);
    const originalField = `foamBoard:original:${key}`;
    const finalField = `foamBoard:final:${key}`;
    form.append(originalField, dataUrlBlob(design.originalDataUrl ?? design.dataUrl), design.fileName);
    form.append(finalField, dataUrlBlob(rendered.finalDataUrl!), rendered.fileName);
    const size = { ...customizationPhysicalSize("foamBoard"), actualArtworkSizeCm: { width: rendered.widthCm ?? 0, height: rendered.heightCm ?? 0 } };
    physicalSizes[originalField] = size; physicalSizes[finalField] = size;
    designMetadata[originalField] = stripData(design); designMetadata[finalField] = stripData(rendered);
  }
  if (data.customMenu?.dataUrl) form.append("customMenu", dataUrlBlob(data.customMenu.dataUrl), data.customMenu.fileName);
  if (data.latteArt?.dataUrl) {
    const originalField = "latteArt:original"; const finalField = "latteArt:final";
    form.append(originalField, dataUrlBlob(data.latteArt.originalDataUrl ?? data.latteArt.dataUrl), data.latteArt.fileName);
    form.append(finalField, dataUrlBlob(data.latteArt.finalDataUrl ?? data.latteArt.dataUrl), `final-latte-art-${data.latteArt.fileName.replace(/\.[^.]+$/, "")}.png`);
    const size = { ...customizationPhysicalSize("latteArt"), actualArtworkSizeCm: data.latteArt.actualArtworkSizeCm };
    physicalSizes[originalField] = size; physicalSizes[finalField] = size;
    designMetadata[originalField] = { actualArtworkSizeCm: data.latteArt.actualArtworkSizeCm };
    designMetadata[finalField] = designMetadata[originalField];
  }
  if (data.customMenu) physicalSizes.customMenu = customizationPhysicalSize("customMenu");
  form.append("payload", JSON.stringify({ ...data, cartDesigns: undefined, sleeveDesigns: undefined, stickerDesigns: undefined, foamBoardDesigns: undefined, customMenu: undefined, latteArt: undefined, physicalSizes, designMetadata }));
  return response<{ ok: true; invoiceNo: string }>(fetch(`${apiBaseUrl}/api/invoices/customization/${encodeURIComponent(token)}`, { method: "POST", body: form }));
}
