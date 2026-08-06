export function toInvoicePayload(record: any) {
  const metadata = record.metadata ?? {};
  const quotation = metadata.quotation ?? {};
  const snapshots = Array.isArray(record.drinkSnapshots) ? record.drinkSnapshots : [];
  const needsHydration = snapshots.length > 0 && !quotation.beverageSnapshots;
  const hydratedQuotation = needsHydration ? (() => {
    const groups = [...new Set(snapshots.map((item: any) => new Date(item.serviceDate).toISOString().slice(0, 10)))];
    const beverageSnapshots: Record<string, any> = {};
    const drinkOrders: Record<string, any> = {};
    const drinkDistributionModeByDate: Record<string, string> = {};
    const excludedBeverageIdsByDate: Record<string, string[]> = {};
    (quotation.serviceDates ?? []).forEach((date: any, index: number) => {
      const dateSnapshots = snapshots.filter((item: any) => new Date(item.serviceDate).toISOString().slice(0, 10) === groups[index]);
      drinkOrders[date.id] = {};
      excludedBeverageIdsByDate[date.id] = [];
      drinkDistributionModeByDate[date.id] = dateSnapshots[0]?.distributionMode ?? (quotation.letHourCoffeeDecideDrinks ? "HOUR_COFFEE_DECIDES" : "MANUAL");
      for (const item of dateSnapshots) {
        const id = item.beverageId ?? item.id;
        beverageSnapshots[id] = { id, name: item.beverageName, imageUrl: item.imageUrlSnapshot ?? undefined, icedAvailable: item.icedAvailableSnapshot, hotAvailable: item.hotAvailableSnapshot };
        drinkOrders[date.id][id] = { ice: item.iceCups, hot: item.hotCups };
        if (item.isExcluded) excludedBeverageIdsByDate[date.id].push(id);
      }
    });
    return { ...quotation, beverageSnapshots, drinkOrders, drinkDistributionModeByDate, excludedBeverageIdsByDate };
  })() : quotation;
  return {
    ...metadata,
    quotation: hydratedQuotation,
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
