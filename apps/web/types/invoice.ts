import type { QuotationData } from "./quotation";
import type { CustomizationByDate } from "./customization";

export type InvoiceUploadFile = {
  fileName: string;
  dataUrl?: string;
  originalDataUrl?: string;
  finalDataUrl?: string;
  fileUrl?: string;
  mimeType?: string;
  physicalSize?: unknown;
  actualArtworkSizeCm?: { width: number; height: number };
};

export type InvoiceDetails = {
  invoiceNo: string;
  invoiceStatus?: "DRAFT" | "SUBMITTED" | "PENDING_PAYMENT_REVIEW" | "PAID" | "CONFIRMED" | "CANCELLED";
  paymentStatus?: "UNPAID" | "RECEIPT_UPLOADED" | "VERIFIED" | "REJECTED";
  quotation: QuotationData;
  eventAddress: string;
  eventArea?: "Selangor" | "Others";
  eventAreaOther?: string;
  dressCode: string;
  customDressCode: string;
  environment: string;
  environmentNotes: string;
  receiptName: string;
  receiptAmount?: string;
  receiptAccount?: string;
  receiptBank?: string;
  receiptDataUrl?: string;
  customMenuFile?: InvoiceUploadFile;
  invoicePdfUrl?: string;
  invoicePdfPublicId?: string;
  receiptUrl?: string;
  receiptMimeType?: string;
  invoiceFiles?: Array<{
    metadata?: { physicalSize?: unknown; kind?: string; finalDesign?: boolean; originalArtwork?: boolean; designKey?: string; geometry?: unknown };
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
  createdAt?: string;
  updatedAt?: string;
  invoiceReference?: string;
  internalNote?: string;
  internalNotes?: Array<{ note: string; createdBy: string; createdAt: string }>;
  editHistory?: Array<{ changedAt: string; changedBy: string; summary?: string }>;
  customizationSubmission?: {
    eventAddress: string;
    dressCode: string;
    customDressCode: string;
    environment: string;
    environmentNotes: string;
    submittedAt: string;
  };
};
