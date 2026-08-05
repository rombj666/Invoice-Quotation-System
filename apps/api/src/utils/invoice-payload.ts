export function toInvoicePayload(record: any) {
  const metadata = record.metadata ?? {};
  return {
    ...metadata,
    invoiceNo: record.invoiceNo,
    invoiceStatus: record.status,
    paymentStatus: record.paymentStatus,
    invoicePdfUrl: record.invoicePdfUrl,
    invoicePdfPublicId: record.invoicePdfPublicId,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
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
    })) ?? [],
    internalNotes: record.internalNotes?.map((note: any) => ({ note: note.note, createdBy: note.createdBy, createdAt: note.createdAt?.toISOString?.() ?? note.createdAt })) ?? [],
    editHistory: record.statusHistory?.map((entry: any) => ({ changedAt: entry.createdAt?.toISOString?.() ?? entry.createdAt, changedBy: entry.changedBy, summary: entry.changeSummary })) ?? []
  };
}
