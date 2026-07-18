import type { QuotationData } from "../types/quotation";
import { apiBaseUrl } from "./api-client";

type FindQuotationInput = {
  name: string;
  phone: string;
  quotationNo: string;
};

export type QuotationLookupResult =
  | { matched: false; access: "NOT_FOUND" }
  | { matched: true; access: "PENDING_REVIEW"; quotationNo: string }
  | { matched: true; access: "APPROVED"; quotation: QuotationData };

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
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
    throw new ApiRequestError(payload?.error ?? "Request failed", response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function loadAllQuotations(): Promise<QuotationData[]> {
  return request<QuotationData[]>("/api/quotations");
}

export function saveQuotationLocally(data: QuotationData): Promise<QuotationData> {
  return request<QuotationData>("/api/quotations", {
    method: "POST",
    body: JSON.stringify({ ...data, status: data.status ?? "PENDING_APPROVAL" })
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
