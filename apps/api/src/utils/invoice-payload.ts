export function toInvoicePayload(record: any) {
  const metadata = record.metadata ?? {};
  const quotation = metadata.quotation ?? {};
  const latestReceipt = [...(record.paymentReceipts ?? [])].sort((left: any, right: any) => new Date(right.uploadedAt ?? 0).getTime() - new Date(left.uploadedAt ?? 0).getTime())[0];
  return {
    ...metadata,
    quotation,
    invoiceNo: record.invoiceNo,
    invoiceStatus: record.status,
    paymentStatus: record.paymentStatus,
    invoicePdfUrl: record.invoicePdfUrl,
    invoicePdfPublicId: record.invoicePdfPublicId,
    createdAt: record.createdAt?.toISOString?.() ?? record.createdAt,
    updatedAt: record.updatedAt?.toISOString?.() ?? record.updatedAt,
    receiptUrl: latestReceipt?.fileUrl,
    receiptName: latestReceipt?.fileName ?? metadata.receiptName ?? "",
    receiptMimeType: latestReceipt?.mimeType,
    invoiceFiles: record.invoiceFiles?.map((file: any) => ({
      fileUrl: file.fileUrl,
      fileName: file.fileName,
      mimeType: file.mimeType,
      metadata: metadata.customizationSubmission?.artworkFiles?.find((entry: any) => entry.fileUrl === file.fileUrl)
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
