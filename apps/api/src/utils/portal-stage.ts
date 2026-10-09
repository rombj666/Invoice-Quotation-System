export type PortalStage = "QUOTATION" | "CUSTOMIZATION" | "COMPLETED";

export function getPortalStage(invoice: { paymentStatus?: string; customizationSubmission?: { submittedAt?: string } } | null): PortalStage {
  if (!invoice) return "QUOTATION";
  if (invoice.customizationSubmission?.submittedAt) return "COMPLETED";
  return ["RECEIPT_UPLOADED", "VERIFIED"].includes(invoice.paymentStatus ?? "") ? "CUSTOMIZATION" : "QUOTATION";
}
