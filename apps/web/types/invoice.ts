import type { QuotationData } from "./quotation";
import type { CustomizationByDate } from "./customization";

export type InvoiceDetails = {
  invoiceNo: string;
  invoiceStatus?: "SUBMITTED";
  paymentStatus?: "RECEIPT_UPLOADED";
  quotation: QuotationData;
  eventAddress: string;
  dressCode: string;
  customDressCode: string;
  environment: string;
  environmentNotes: string;
  receiptName: string;
  receiptDataUrl?: string;
  cartDesigns?: CustomizationByDate;
  stickerDesigns?: CustomizationByDate;
  sleeveDesigns?: CustomizationByDate;
  submittedAt?: string;
};
