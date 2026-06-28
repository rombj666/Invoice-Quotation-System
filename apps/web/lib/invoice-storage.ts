import type { InvoiceDetails } from "../types/invoice";
import { apiBaseUrl } from "./api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
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

export function saveInvoiceLocally(data: InvoiceDetails): Promise<InvoiceDetails> {
  return request<InvoiceDetails>("/api/invoices", {
    method: "POST",
    body: JSON.stringify({ ...data, invoiceStatus: data.invoiceStatus ?? "SUBMITTED", paymentStatus: data.paymentStatus ?? "RECEIPT_UPLOADED" })
  });
}

export function loadInvoiceByNo(invoiceNo: string): Promise<InvoiceDetails | null> {
  return request<InvoiceDetails>(`/api/invoices/${encodeURIComponent(invoiceNo)}`).catch(() => null);
}
