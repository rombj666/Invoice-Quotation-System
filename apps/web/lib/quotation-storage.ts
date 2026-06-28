import type { QuotationData } from "../types/quotation";

const latestKey = "hour-coffee-latest-quotation";
const quotationListKey = "hourCoffeeQuotations";

export function loadAllQuotations(): QuotationData[] {
  const raw = localStorage.getItem(quotationListKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QuotationData[];
  } catch {
    return [];
  }
}

export function saveQuotationLocally(data: QuotationData): void {
  const quotation = { ...data, status: data.status ?? "PENDING_APPROVAL" } satisfies QuotationData;
  const quotations = loadAllQuotations();
  const next = [quotation, ...quotations.filter((item) => item.quotationNo !== quotation.quotationNo)];
  localStorage.setItem(quotationListKey, JSON.stringify(next));
  localStorage.setItem(latestKey, JSON.stringify(quotation));
  localStorage.setItem(`hour-coffee-quotation-${quotation.quotationNo}`, JSON.stringify(quotation));
}

export function loadLatestQuotation(): QuotationData | null {
  const raw = localStorage.getItem(latestKey);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuotationData;
  } catch {
    return null;
  }
}

export function loadQuotationByNo(quotationNo: string): QuotationData | null {
  const fromList = loadAllQuotations().find((quotation) => quotation.quotationNo === quotationNo);
  if (fromList) return fromList;
  const raw = localStorage.getItem(`hour-coffee-quotation-${quotationNo}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as QuotationData;
  } catch {
    return null;
  }
}

export function approveQuotation(quotationNo: string): void {
  const quotation = loadQuotationByNo(quotationNo);
  if (!quotation) return;
  saveQuotationLocally({ ...quotation, status: "APPROVED" });
}

export function deleteQuotation(quotationNo: string): void {
  const quotations = loadAllQuotations().filter((quotation) => quotation.quotationNo !== quotationNo);
  localStorage.setItem(quotationListKey, JSON.stringify(quotations));
  localStorage.removeItem(`hour-coffee-quotation-${quotationNo}`);
}

export function getNextQuotationNo(): string {
  const current = Number(localStorage.getItem("hour-coffee-quotation-sequence") ?? "0") + 1;
  localStorage.setItem("hour-coffee-quotation-sequence", String(current));
  return `Q${String(current).padStart(5, "0")}`;
}
