import type { CustomizationByDate } from "../types/customization";
import type { InvoiceDetails } from "../types/invoice";
import { apiBaseUrl } from "./api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init?.headers : {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function loadAllInvoices(): Promise<InvoiceDetails[]> {
  return request<InvoiceDetails[]>("/api/invoices");
}

export async function getNextInvoiceNo(): Promise<string> {
  const payload = await request<{ invoiceNo: string }>("/api/invoices/next-number");
  return payload.invoiceNo;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1] ?? "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mimeType });
}

export function saveInvoiceLocally(data: InvoiceDetails): Promise<InvoiceDetails> {
  const formData = new FormData();

  function stripDesignDataUrls(designs: CustomizationByDate = {}) {
    return Object.fromEntries(Object.entries(designs).map(([key, design]) => {
      if (!design) return [key, design];
      const { dataUrl, originalDataUrl, ...metadata } = design;
      return [key, metadata];
    }));
  }

  const payload = {
    ...data,
    invoiceStatus: data.invoiceStatus ?? "SUBMITTED",
    paymentStatus: data.paymentStatus ?? "RECEIPT_UPLOADED",
    receiptDataUrl: undefined,
    cartDesigns: stripDesignDataUrls(data.cartDesigns),
    stickerDesigns: stripDesignDataUrls(data.stickerDesigns),
    sleeveDesigns: stripDesignDataUrls(data.sleeveDesigns)
  };

  formData.append("payload", JSON.stringify(payload));
  if (data.receiptDataUrl) {
    formData.append("receipt", dataUrlToBlob(data.receiptDataUrl), data.receiptName || "receipt");
  }

  ([
    ["cartDesigns", data.cartDesigns],
    ["stickerDesigns", data.stickerDesigns],
    ["sleeveDesigns", data.sleeveDesigns]
  ] as const).forEach(([groupName, designs]) => {
    Object.entries(designs ?? {}).forEach(([designKey, design]) => {
      if (!design?.dataUrl) return;
      formData.append(`${groupName}:${designKey}`, dataUrlToBlob(design.dataUrl), design.fileName || "design.webp");
    });
  });

  return request<InvoiceDetails>("/api/invoices", {
    method: "POST",
    body: formData
  });
}

export function saveInvoiceLocallyJson(data: InvoiceDetails): Promise<InvoiceDetails> {
  return request<InvoiceDetails>("/api/invoices", {
    method: "POST",
    body: JSON.stringify({ ...data, invoiceStatus: data.invoiceStatus ?? "SUBMITTED", paymentStatus: data.paymentStatus ?? "RECEIPT_UPLOADED" })
  });
}

export function loadInvoiceByNo(invoiceNo: string): Promise<InvoiceDetails | null> {
  return request<InvoiceDetails>(`/api/invoices/${encodeURIComponent(invoiceNo)}`).catch(() => null);
}
