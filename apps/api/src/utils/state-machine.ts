// Workflow safety: quotation and invoice state-machine guards. This module is
// the single source of truth for which lifecycle transitions are legal.

import { InvoiceStatus, PaymentStatus, Prisma, QuotationStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Quotation state machine
// ---------------------------------------------------------------------------

export const QUOTATION_FINAL_STATUSES: ReadonlySet<QuotationStatus> = new Set<QuotationStatus>(["COMPLETED"]);

// Legal transitions: from -> allowed target statuses.
const QUOTATION_TRANSITIONS: Record<QuotationStatus, ReadonlySet<QuotationStatus>> = {
  PENDING_APPROVAL: new Set(["GENERATED_INVOICE"]),
  GENERATED_INVOICE: new Set(["COMPLETED"]),
  COMPLETED: new Set()
};

export function assertValidQuotationTransition(
  from: QuotationStatus,
  to: QuotationStatus,
  opts: { allowSame?: boolean } = {}
): void {
  if (opts.allowSame && from === to) return;
  if (!QUOTATION_TRANSITIONS[from]?.has(to)) {
    throw new Error(`Illegal quotation status transition: ${from} -> ${to}`);
  }
}

export function canQuotationCreateInvoice(status: QuotationStatus): { allowed: boolean; reason?: string } {
  if (status !== "PENDING_APPROVAL") return { allowed: false, reason: "Only pending approval quotations can generate an invoice." };
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Invoice state machine (single lifecycle: overall status + payment status)
// ---------------------------------------------------------------------------

export const INVOICE_FINAL_STATUSES: ReadonlySet<InvoiceStatus> = new Set<InvoiceStatus>(["CONFIRMED", "CANCELLED"]);

// Legal (status, paymentStatus) pairs — a single lifecycle. Any pair not in
// this map is self-contradictory and is rejected before it can be saved.
const INVOICE_STATE_PAIRS: ReadonlySet<string> = new Set<string>([
  "DRAFT|UNPAID",
  "SUBMITTED|UNPAID",
  "SUBMITTED|RECEIPT_UPLOADED",
  "SUBMITTED|VERIFIED",
  "PENDING_PAYMENT_REVIEW|RECEIPT_UPLOADED",
  "PENDING_PAYMENT_REVIEW|VERIFIED",
  "PENDING_PAYMENT_REVIEW|REJECTED",
  "PAID|VERIFIED",
  "CONFIRMED|VERIFIED",
  "CANCELLED|UNPAID",
  "CANCELLED|RECEIPT_UPLOADED",
  "CANCELLED|VERIFIED",
  "CANCELLED|REJECTED"
]);

// Legal transitions from (status, paymentStatus) to target pairs.
const INVOICE_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  "DRAFT|UNPAID": new Set(["SUBMITTED|UNPAID", "CANCELLED|UNPAID"]),
  "SUBMITTED|UNPAID": new Set(["SUBMITTED|RECEIPT_UPLOADED", "SUBMITTED|VERIFIED", "CANCELLED|UNPAID"]),
  "SUBMITTED|RECEIPT_UPLOADED": new Set(["SUBMITTED|VERIFIED", "PENDING_PAYMENT_REVIEW|RECEIPT_UPLOADED", "CANCELLED|RECEIPT_UPLOADED"]),
  "PENDING_PAYMENT_REVIEW|RECEIPT_UPLOADED": new Set([
    "PENDING_PAYMENT_REVIEW|VERIFIED",
    "PENDING_PAYMENT_REVIEW|REJECTED",
    "CANCELLED|RECEIPT_UPLOADED"
  ]),
  "PENDING_PAYMENT_REVIEW|REJECTED": new Set(["PENDING_PAYMENT_REVIEW|RECEIPT_UPLOADED", "CANCELLED|REJECTED"]),
  "PENDING_PAYMENT_REVIEW|VERIFIED": new Set(["PAID|VERIFIED", "CONFIRMED|VERIFIED", "CANCELLED|VERIFIED"]),
  "PAID|VERIFIED": new Set(["CONFIRMED|VERIFIED", "CANCELLED|VERIFIED"]),
  "CONFIRMED|VERIFIED": new Set(["CANCELLED|VERIFIED"]),
  "CANCELLED|UNPAID": new Set(),
  "CANCELLED|RECEIPT_UPLOADED": new Set(),
  "CANCELLED|VERIFIED": new Set(),
  "CANCELLED|REJECTED": new Set()
};

function invoicePairKey(status: InvoiceStatus, paymentStatus: PaymentStatus): string {
  return `${status}|${paymentStatus}`;
}

export function assertValidInvoiceStatePair(status: InvoiceStatus, paymentStatus: PaymentStatus): void {
  if (!INVOICE_STATE_PAIRS.has(invoicePairKey(status, paymentStatus))) {
    throw new Error(`Illegal invoice state combination: status=${status}, paymentStatus=${paymentStatus}`);
  }
}

export function assertValidInvoiceTransition(
  fromStatus: InvoiceStatus,
  fromPaymentStatus: PaymentStatus,
  toStatus: InvoiceStatus,
  toPaymentStatus: PaymentStatus,
  opts: { allowSame?: boolean } = {}
): void {
  const fromKey = invoicePairKey(fromStatus, fromPaymentStatus);
  const toKey = invoicePairKey(toStatus, toPaymentStatus);
  if (opts.allowSame && fromKey === toKey) return;
  assertValidInvoiceStatePair(toStatus, toPaymentStatus);
  if (!INVOICE_TRANSITIONS[fromKey]?.has(toKey)) {
    throw new Error(`Illegal invoice state transition: ${fromKey} -> ${toKey}`);
  }
}

// ---------------------------------------------------------------------------
// Idempotent submission helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the error is a unique-constraint violation on the given
 * column — used to turn concurrent duplicate submissions into a clean 409.
 */
export function isUniqueConflict(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(column) : String(target ?? "").includes(column);
}
