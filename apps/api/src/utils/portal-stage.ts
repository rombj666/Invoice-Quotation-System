export type PortalStage = "QUOTATION" | "PAYMENT" | "CUSTOMIZATION" | "COMPLETED";

export function getPortalStage(invoice: { paymentStatus?: string; customizationSubmission?: { submittedAt?: string } } | null): PortalStage {
  if (!invoice) return "QUOTATION";
  if (invoice.customizationSubmission?.submittedAt) return "COMPLETED";
  return invoice.paymentStatus === "VERIFIED" ? "CUSTOMIZATION" : "PAYMENT";
}
