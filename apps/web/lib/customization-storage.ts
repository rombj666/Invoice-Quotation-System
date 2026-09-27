import type { CustomizationByDate } from "../types/customization";
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
  eventAddress: string; dressCode: string; customDressCode: string; environment: string; environmentNotes: string;
  cartDesigns: CustomizationByDate; sleeveDesigns: CustomizationByDate; stickerDesigns: CustomizationByDate; customMenu?: InvoiceUploadFile; latteArt?: InvoiceUploadFile;
};

export function submitCustomization(token: string, data: CustomizationSubmission) {
  const form = new FormData();
  const physicalSizes: Record<string, { widthCm?: number; heightCm?: number }> = {};
  const appendDesigns = (prefix: string, designs: CustomizationByDate) => Object.entries(designs).forEach(([key, design]) => {
    if (!design) return;
    const layers = design.logos?.length ? design.logos : [design];
    layers.forEach((layer, index) => {
      const field = `${prefix}:${key}:${index}`;
      form.append(field, dataUrlBlob(layer.originalDataUrl ?? layer.dataUrl), layer.fileName);
      physicalSizes[field] = { widthCm: design.widthCm, heightCm: design.heightCm };
    });
  });
  appendDesigns("cart", data.cartDesigns);
  appendDesigns("sleeve", data.sleeveDesigns);
  appendDesigns("sticker", data.stickerDesigns);
  if (data.customMenu?.dataUrl) form.append("customMenu", dataUrlBlob(data.customMenu.dataUrl), data.customMenu.fileName);
  if (data.latteArt?.dataUrl) form.append("latteArt", dataUrlBlob(data.latteArt.dataUrl), data.latteArt.fileName);
  form.append("payload", JSON.stringify({ ...data, cartDesigns: undefined, sleeveDesigns: undefined, stickerDesigns: undefined, customMenu: undefined, latteArt: undefined, physicalSizes }));
  return response<{ ok: true; invoiceNo: string }>(fetch(`${apiBaseUrl}/api/invoices/customization/${encodeURIComponent(token)}`, { method: "POST", body: form }));
}
