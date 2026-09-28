// Workflow safety: quotation/invoice state-machine ("traffic light") guards,
// single lifecycle validation, idempotent submission helpers and automatic
// quotation expiration. This module is the single source of truth for what
// state transitions are legal.

import { InvoiceStatus, PaymentStatus, Prisma, QuotationStatus } from "@prisma/client";
import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Quotation state machine
// ---------------------------------------------------------------------------

export const QUOTATION_FINAL_STATUSES: ReadonlySet<QuotationStatus> = new Set<QuotationStatus>([
  "CONVERTED_TO_INVOICE",
  "CANCELLED",
  "EXPIRED"
]);

// Legal transitions: from -> allowed target statuses.
const QUOTATION_TRANSITIONS: Record<QuotationStatus, ReadonlySet<QuotationStatus>> = {
  DRAFT: new Set(["PENDING_APPROVAL", "CANCELLED", "EXPIRED"]),
  PENDING_APPROVAL: new Set(["CONVERTED_TO_INVOICE", "APPROVED", "RETURNED_FOR_EDIT", "CANCELLED", "EXPIRED"]),
  APPROVED: new Set(["REVIEWED", "SENT", "CONVERTED_TO_INVOICE", "CANCELLED", "EXPIRED"]),
  REVIEWED: new Set(["SENT", "APPROVED", "CONVERTED_TO_INVOICE", "CANCELLED", "EXPIRED"]),
  SENT: new Set(["CONVERTED_TO_INVOICE", "CANCELLED", "EXPIRED"]),
  RETURNED_FOR_EDIT: new Set(["PENDING_APPROVAL", "CANCELLED", "EXPIRED"]),
  CONVERTED_TO_INVOICE: new Set(),
  CANCELLED: new Set(),
  EXPIRED: new Set()
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

export function canQuotationCreateInvoice(
  status: QuotationStatus,
  expiresAt: Date | null | undefined,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (status === "CANCELLED") return { allowed: false, reason: "The quotation has been cancelled and can no longer be invoiced." };
  if (status === "EXPIRED") return { allowed: false, reason: "The quotation has expired and can no longer be invoiced." };
  if (status === "CONVERTED_TO_INVOICE") return { allowed: false, reason: "This quotation already has an invoice." };
  if (status !== "PENDING_APPROVAL" && status !== "APPROVED") return { allowed: false, reason: "Only submitted quotations can generate an invoice." };
  if (expiresAt && new Date(expiresAt).getTime() < now.getTime()) {
    return { allowed: false, reason: "The quotation has expired and can no longer be invoiced." };
  }
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
// Automatic expiration (7-day quoted validity)
// ---------------------------------------------------------------------------

export const EXPIRABLE_QUOTATION_STATUSES: QuotationStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REVIEWED",
  "SENT",
  "RETURNED_FOR_EDIT"
];

/**
 * Marks overdue quotations (expiresAt in the past and not yet terminal) as
 * EXPIRED. Safe to call on every read path (lazy check) and on a timer.
 * Returns the number of quotations that were expired.
 */
export async function expireOverdueQuotations(now: Date = new Date()): Promise<number> {
  const overdue = await prisma.quotation.findMany({
    where: {
      status: { in: EXPIRABLE_QUOTATION_STATUSES },
      expiresAt: { not: null, lt: now }
    },
    select: { id: true, quotationNo: true, status: true }
  });
  for (const quotation of overdue) {
    await prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        status: "EXPIRED",
        statusHistory: {
          create: {
            fromStatus: quotation.status,
            toStatus: "EXPIRED",
            changedBy: "system",
            changeSummary: "Quotation expired automatically after the validity window passed."
          }
        }
      }
    });
    console.info(`[quotation-expiry] expired ${quotation.quotationNo} (was ${quotation.status})`);
  }
  return overdue.length;
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
