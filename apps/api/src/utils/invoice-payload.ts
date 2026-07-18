import { normalizeQuotationCartPrices } from "./addons";

export function toInvoicePayload(record: any) {
  const metadata = record.metadata ?? {};
  return {
    ...metadata,
    ...(metadata.quotation ? { quotation: normalizeQuotationCartPrices(metadata.quotation) } : {}),
    invoiceNo: record.invoiceNo,
    invoiceStatus: record.status,
    paymentStatus: record.paymentStatus,
    invoicePdfUrl: record.invoicePdfUrl,
    receiptUrl: record.paymentReceipts?.[0]?.fileUrl,
    receiptMimeType: record.paymentReceipts?.[0]?.mimeType,
    invoiceFiles: record.invoiceFiles?.map((file: any) => ({
      fileUrl: file.fileUrl,
      fileName: file.fileName,
      mimeType: file.mimeType
    })) ?? [],
    customizationUrls: record.customizationFiles?.map((file: any) => ({
      type: file.type,
      designKey: file.designKey,
      fileUrl: file.fileUrl,
      fileName: file.fileName,
      mimeType: file.mimeType,
      metadata: file.metadata
    })) ?? []
  };
}
