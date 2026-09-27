import type { InvoiceDetails } from "../types/invoice";
import type { QuotationData } from "../types/quotation";
import { apiBaseUrl } from "./api-client";

export type PortalPayload = { stage: "QUOTATION" | "PAYMENT" | "CUSTOMIZATION" | "COMPLETED"; quotation: QuotationData; invoice: InvoiceDetails | null };

async function result<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Request failed.");
  return payload as T;
}

export async function loadPortal(token: string) {
  return result<PortalPayload>(await fetch(`${apiBaseUrl}/api/portal/${encodeURIComponent(token)}`, { cache: "no-store" }));
}

export async function uploadPortalReceipt(token: string, file: File) {
  const form = new FormData();
  form.append("receipt", file, file.name);
  return result<{ paymentStatus: "RECEIPT_UPLOADED" }>(await fetch(`${apiBaseUrl}/api/portal/${encodeURIComponent(token)}/receipt`, { method: "POST", body: form }));
}
