import { calculateQuotationDocumentPricing, getQuotationServiceHours } from "@hour-coffee/shared";
import type { QuotationData, ServiceDate } from "../types/quotation";

export { getQuotationBaristaPricing } from "@hour-coffee/shared";
export type QuotationPricingBreakdown = ReturnType<typeof calculateQuotationDocumentPricing>;

export function getDurationLabel(date: ServiceDate): string {
  return getQuotationServiceHours(date) > 4 ? "Full Day" : "Half Day";
}

export function calculateQuotationPricing(data: QuotationData): QuotationPricingBreakdown {
  return calculateQuotationDocumentPricing(data, data.extraCharges ?? []);
}
