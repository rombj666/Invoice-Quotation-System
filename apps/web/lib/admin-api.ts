import type { InvoiceDetails } from "../types/invoice";
import type { QuotationData } from "../types/quotation";
import { apiBaseUrl } from "./api-client";

export type DashboardPeriod = "today" | "week" | "month" | "all";
export type LeadTotals = { total: number; new: number; contacted: number; converted: number; followUp: number; won: number; lost: number };
export type AnalyticsTotals = { visitors: number; started: number; inProgress: number; notSubmitted: number; submitted: number; conversionRate: number };
export type FunnelTotals = Pick<AnalyticsTotals, "visitors" | "started" | "submitted" | "notSubmitted" | "inProgress">;
export type TrendPoint = { label: string; visitors: number; started: number; submitted: number };
export type TrendData = { grouping: "hour" | "day" | "month"; points: TrendPoint[] };
export type FollowUpLead = { quotationNo: string; customer: string; phone: string; company?: string; submittedAt: string; followUpStatus: string; followUpNote?: string };
export type ExtraChargeInput = { title: string; description?: string; amount: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Request failed");
  return payload as T;
}

export function loadDashboard(period: DashboardPeriod) {
  const query = `?period=${period}`;
  return Promise.all([
    request<LeadTotals>(`/api/admin/dashboard/lead-totals${query}`),
    request<AnalyticsTotals>(`/api/admin/dashboard/analytics-totals${query}`),
    request<FunnelTotals>(`/api/admin/dashboard/funnel${query}`),
    request<TrendData>(`/api/admin/dashboard/trend${query}`),
    request<FollowUpLead[]>(`/api/admin/dashboard/follow-up-queue${query}`)
  ]).then(([leads, analytics, funnel, trend, queue]) => ({ leads, analytics, funnel, trend, queue }));
}

export function updateQuotationFollowUp(quotationNo: string, followUpStatus: string, followUpNote?: string) {
  return request<QuotationData>(`/api/admin/quotations/${encodeURIComponent(quotationNo)}/follow-up`, {
    method: "PATCH",
    body: JSON.stringify({ followUpStatus, followUpNote })
  });
}

export function updateAdminQuotation(originalQuotationNo: string, data: QuotationData, pdf: Blob) {
  const form = new FormData();
  form.append("payload", JSON.stringify(data));
  form.append("quotationPdf", pdf, `${data.quotationNo}.pdf`);
  return request<QuotationData>(`/api/admin/quotations/${encodeURIComponent(originalQuotationNo)}`, { method: "PATCH", body: form });
}

export function prepareAdminQuotationEdit(originalQuotationNo: string, data: QuotationData) {
  return request<QuotationData>(`/api/admin/quotations/${encodeURIComponent(originalQuotationNo)}/preview`, {
    method: "POST",
    body: JSON.stringify(data)
  });
}

function extraChargeForm(pdf: Blob, quotationNo: string, payload: ExtraChargeInput | Record<string, never>) {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  form.append("quotationPdf", pdf, `${quotationNo}.pdf`);
  return form;
}

export function addQuotationExtraCharge(quotationId: string, quotationNo: string, input: ExtraChargeInput, pdf: Blob) {
  return request<QuotationData>(`/api/admin/quotations/${encodeURIComponent(quotationId)}/extra-charges`, {
    method: "POST",
    body: extraChargeForm(pdf, quotationNo, input)
  });
}

export function updateQuotationExtraCharge(quotationId: string, quotationNo: string, chargeId: string, input: ExtraChargeInput, pdf: Blob) {
  return request<QuotationData>(`/api/admin/quotations/${encodeURIComponent(quotationId)}/extra-charges/${encodeURIComponent(chargeId)}`, {
    method: "PATCH",
    body: extraChargeForm(pdf, quotationNo, input)
  });
}

export function deleteQuotationExtraCharge(quotationId: string, quotationNo: string, chargeId: string, pdf: Blob) {
  return request<QuotationData>(`/api/admin/quotations/${encodeURIComponent(quotationId)}/extra-charges/${encodeURIComponent(chargeId)}`, {
    method: "DELETE",
    body: extraChargeForm(pdf, quotationNo, {})
  });
}

export function updateAdminInvoice(originalInvoiceNo: string, data: InvoiceDetails, pdf: Blob) {
  const form = new FormData();
  form.append("payload", JSON.stringify(data));
  form.append("invoicePdf", pdf, `${data.invoiceNo}.pdf`);
  return request<InvoiceDetails>(`/api/admin/invoices/${encodeURIComponent(originalInvoiceNo)}`, { method: "PATCH", body: form });
}
