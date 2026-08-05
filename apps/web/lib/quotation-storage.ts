import type { InvoiceDetails } from "../types/invoice";
import type { PreviousQuotationSummary, QuotationData } from "../types/quotation";
import { apiBaseUrl } from "./api-client";
import { getQuotationAnalyticsSessionId } from "./quotation-analytics";

type FindQuotationInput = {
  name: string;
  phone: string;
  quotationNo: string;
};

export type QuotationLookupResult =
  | { matched: false; access: "NOT_FOUND" }
  | { matched: true; access: "PENDING_REVIEW"; quotationNo: string }
  | { matched: true; access: "DRAFT_INVOICE"; invoiceNo: string }
  | { matched: true; access: "SUBMITTED_INVOICE"; invoiceNo: string; invoice: InvoiceDetails }
  | { matched: true; access: "APPROVED"; quotation: QuotationData };

export type PreviousQuotationHistory = {
  quotations: PreviousQuotationSummary[];
};

export type PreviousQuotationLookupResult =
  | { access: "QUOTATION_SUMMARY"; quotation: QuotationData }
  | { access: "INVOICE_STARTED" }
  | { access: "NOT_FOUND" };

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number, readonly payload?: Record<string, unknown>) {
    super(message);
  }
}

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
    throw new ApiRequestError(payload?.error ?? "Request failed", response.status, payload ?? undefined);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function loadAllQuotations(): Promise<QuotationData[]> {
  return request<QuotationData[]>("/api/quotations");
}

export function saveQuotationLocally(data: QuotationData, quotationPdf: Blob): Promise<QuotationData> {
  const trackedData = { ...data, anonymousSessionId: getQuotationAnalyticsSessionId() };
  const formData = new FormData();
  formData.append("payload", JSON.stringify({ ...trackedData, status: data.status ?? "PENDING_APPROVAL" }));
  formData.append("quotationPdf", quotationPdf, `${data.quotationNo}.pdf`);
  return fetch(`${apiBaseUrl}/api/quotations`, { method: "POST", body: formData }).then(async (response) => {
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new ApiRequestError(payload?.error ?? "Request failed", response.status, payload ?? undefined);
    }
    return response.json() as Promise<QuotationData>;
  });
}

export function loadQuotationByNo(quotationNo: string): Promise<QuotationData | null> {
  return request<QuotationData>(`/api/quotations/${encodeURIComponent(quotationNo)}`).catch(() => null);
}

export async function findQuotation(input: FindQuotationInput): Promise<QuotationLookupResult> {
  try {
    return await request<QuotationLookupResult>("/api/quotations/find", {
      method: "POST",
      body: JSON.stringify(input)
    });
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return { matched: false, access: "NOT_FOUND" };
    throw error;
  }
}

export function findPreviousQuotations(input: { name: string; phone: string; email: string }) {
  return request<PreviousQuotationHistory>("/api/quotations/history", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function loadPreviousQuotationSummary(
  quotationNo: string,
  identity: { name: string; phone: string; email: string }
): Promise<PreviousQuotationLookupResult> {
  try {
    return await request<PreviousQuotationLookupResult>(
      `/api/quotations/${encodeURIComponent(quotationNo)}/summary`,
      { method: "POST", body: JSON.stringify(identity) }
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 409) return { access: "INVOICE_STARTED" };
    if (error instanceof ApiRequestError && error.status === 404) return { access: "NOT_FOUND" };
    throw error;
  }
}

export function approveQuotation(quotationNo: string): Promise<QuotationData> {
  return request<QuotationData>(`/api/quotations/${encodeURIComponent(quotationNo)}/approve`, {
    method: "PATCH"
  });
}

export function deleteQuotation(quotationNo: string): Promise<void> {
  return request<void>(`/api/quotations/${encodeURIComponent(quotationNo)}`, {
    method: "DELETE"
  });
}

export async function getNextQuotationNo(): Promise<string> {
  const payload = await request<{ quotationNo: string }>("/api/quotations/next-number");
  return payload.quotationNo;
}
