import type { QuotationData, QuotationExtraCharge } from "../types/quotation";
import { formatCompactDate } from "./formatters";

export function extraChargeDateLabel(charge: QuotationExtraCharge, dates: QuotationData["serviceDates"]): string {
  if (charge.appliesToAllDates !== false && !charge.serviceDateIds?.length) return "All Service Dates";
  const ids = new Set(charge.serviceDateIds ?? []);
  const selected = dates.filter((date) => ids.has(date.id)).sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  return selected.length ? selected.map((date) => formatCompactDate(date.serviceDate)).join(", ") : "Select service dates";
}
