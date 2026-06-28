import type { InvoiceDetails } from "../types/invoice";

const invoiceListKey = "hourCoffeeInvoices";

export function loadAllInvoices(): InvoiceDetails[] {
  const raw = localStorage.getItem(invoiceListKey);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InvoiceDetails[];
  } catch {
    return [];
  }
}

export function getNextInvoiceNo(): string {
  const current = Number(localStorage.getItem("hour-coffee-invoice-sequence") ?? "0") + 1;
  localStorage.setItem("hour-coffee-invoice-sequence", String(current));
  return `A${String(current).padStart(5, "0")}`;
}

export function saveInvoiceLocally(data: InvoiceDetails): void {
  const invoice = { ...data, invoiceStatus: data.invoiceStatus ?? "SUBMITTED", paymentStatus: data.paymentStatus ?? "RECEIPT_UPLOADED" } satisfies InvoiceDetails;
  const invoices = loadAllInvoices();
  const next = [invoice, ...invoices.filter((item) => item.invoiceNo !== invoice.invoiceNo)];
  localStorage.setItem(invoiceListKey, JSON.stringify(next));
  localStorage.setItem(`hour-coffee-invoice-${invoice.invoiceNo}`, JSON.stringify(invoice));
  localStorage.setItem("hour-coffee-latest-invoice", JSON.stringify(invoice));
}

export function loadInvoiceByNo(invoiceNo: string): InvoiceDetails | null {
  const fromList = loadAllInvoices().find((invoice) => invoice.invoiceNo === invoiceNo);
  if (fromList) return fromList;
  const raw = localStorage.getItem(`hour-coffee-invoice-${invoiceNo}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as InvoiceDetails;
  } catch {
    return null;
  }
}
