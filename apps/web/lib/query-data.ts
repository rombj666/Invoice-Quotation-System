import type { QuotationData } from "../types/quotation";

export function encodeQuotationForQuery(data: QuotationData): string {
  return encodeURIComponent(JSON.stringify(data));
}

export function decodeQuotationFromQuery(value: string | null): QuotationData | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as QuotationData;
  } catch {
    return null;
  }
}
