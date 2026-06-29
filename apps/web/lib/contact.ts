import type { InvoiceDetails } from "../types/invoice";
import type { QuotationData } from "../types/quotation";
import { formatCompactDate } from "./formatters";

export const PARTNER_WHATSAPP_NUMBER = "60125689129";

type PartnerContactData = QuotationData | InvoiceDetails;

function isInvoiceDetails(data: PartnerContactData): data is InvoiceDetails {
  return "quotation" in data;
}

function valueOrFallback(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "Not provided";
  const text = String(value).trim();
  return text || "Not provided";
}

function getQuotation(data: PartnerContactData): QuotationData {
  return isInvoiceDetails(data) ? data.quotation : data;
}

function getEventAddress(data: PartnerContactData): string {
  if (isInvoiceDetails(data) && data.eventAddress) return data.eventAddress;
  const quotation = getQuotation(data);
  return quotation.fullAddress || quotation.location;
}

function getAddonNames(quotation: QuotationData): string {
  const addonNames = [
    ...quotation.selectedAddons.map((addon) => addon.name),
    quotation.hasCupStickers ? "Custom Cup Stickers" : "",
    quotation.hasCupSleeves ? "Custom Cup Sleeves" : ""
  ].filter((name) => name.trim());

  return addonNames.length ? addonNames.join(", ") : "None";
}

function getEventDates(quotation: QuotationData): string {
  if (!quotation.serviceDates.length) return "Not provided";
  return quotation.serviceDates.map((date) => `- ${formatCompactDate(date.serviceDate)}`).join("\n");
}

export function buildPartnerWhatsAppMessage(quotationOrInvoiceData: PartnerContactData): string {
  const quotation = getQuotation(quotationOrInvoiceData);
  const totalCups = quotation.serviceDates.reduce((sum, date) => sum + Number(date.cups || 0), 0);

  return `Hi Hour Coffee, I would like to discuss my quotation.

Name:
${valueOrFallback(quotation.customer.name)}

Email:
${valueOrFallback(quotation.customer.email)}

Company Address:
${valueOrFallback(quotation.customer.billingAddress)}

Phone Number:
${valueOrFallback(quotation.customer.phone)}

Quotation No.:
${valueOrFallback(quotation.quotationNo)}

Total Cups:
${totalCups || "Not provided"}

Event Address:
${valueOrFallback(getEventAddress(quotationOrInvoiceData))}

Event Date:
${getEventDates(quotation)}

Extra Add-ons:
${getAddonNames(quotation)}

Please help me check and confirm the details. Thank you.`;
}

export function openPartnerWhatsApp(quotationOrInvoiceData: PartnerContactData) {
  const message = buildPartnerWhatsAppMessage(quotationOrInvoiceData);
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${PARTNER_WHATSAPP_NUMBER}?text=${encodedMessage}`;
  window.open(url, "_blank");
}
