// Notification service: records workflow events into the Notification table
// (notification center). The project has no email/IM dependency today, so this
// implementation provides the durable event log and an in-app notification
// center. A delivery channel (email/WhatsApp) can be plugged in later by
// extending `sendNotification` without changing the call sites or schema.

import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";

export type NotificationRecipient = {
  role: "admin" | "customer";
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type NotificationInput = {
  type: string;
  recipient: NotificationRecipient;
  title: string;
  message: string;
  referenceNo?: string | null;
  link?: string | null;
};

export function notificationLink(referenceNo: string, kind: "quotation" | "invoice"): string {
  if (kind === "quotation") return `/customer/quotation?no=${encodeURIComponent(referenceNo)}`;
  return `/customer/invoice?no=${encodeURIComponent(referenceNo)}`;
}

export async function createNotification(
  input: NotificationInput,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma;
  await client.notification.create({
    data: {
      type: input.type,
      recipientRole: input.recipient.role,
      recipientName: input.recipient.name ?? null,
      recipientPhone: input.recipient.phone ?? null,
      recipientEmail: input.recipient.email ?? null,
      title: input.title,
      message: input.message,
      referenceNo: input.referenceNo ?? null,
      link: input.link ?? null
    }
  });
}

// The single dispatch point for future email/WhatsApp delivery. For now the
// event is persisted in the notification center; when a channel is added this
// function is the only place that needs to change.
export async function sendNotification(input: NotificationInput, tx?: Prisma.TransactionClient): Promise<void> {
  await createNotification(input, tx);
  console.info(`[notification] ${input.type} -> ${input.recipient.role}`, {
    referenceNo: input.referenceNo ?? null,
    title: input.title
  });
}
