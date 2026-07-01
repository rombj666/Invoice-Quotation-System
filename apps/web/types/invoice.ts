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
  invoicePdfUrl?: string;
  receiptUrl?: string;
  receiptMimeType?: string;
  invoiceFiles?: Array<{
    fileUrl: string;
    fileName: string;
    mimeType?: string;
  }>;
  cartDesigns?: CustomizationByDate;
  stickerDesigns?: CustomizationByDate;
  sleeveDesigns?: CustomizationByDate;
  customizationUrls?: Array<{
    type: "CART_DESIGN" | "CUP_STICKER" | "CUP_SLEEVE";
    designKey: string;
    fileUrl: string;
    fileName: string;
    mimeType?: string;
    metadata?: unknown;
  }>;
  submittedAt?: string;
};
