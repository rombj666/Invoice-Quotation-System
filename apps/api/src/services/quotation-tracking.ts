import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

export function isTrackingId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function malaysiaVisitDate(now = new Date()): Date {
  return new Date(`${new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export type TrackingMilestone = "step1EngagedAt" | "step2VisitedAt" | "packageSelectedAt" | "submittedAt";

export async function recordQuotationTracking(
  db: Prisma.TransactionClient,
  input: { visitorId: string; sessionId: string; visitDate?: string },
  milestone?: TrackingMilestone,
  now = new Date()
) {
  const visitDate = malaysiaVisitDate(now);
  const where = { visitorId_visitDate: { visitorId: input.visitorId, visitDate } };
  // Server time determines the day, including submissions that finish after midnight.
  const sessionId = input.visitDate === visitDate.toISOString().slice(0, 10) ? input.sessionId : randomUUID();
  const session = await db.quotationTrackingSession.upsert({
    where,
    create: { sessionId, visitorId: input.visitorId, visitDate, firstVisitedAt: now, lastActivityAt: now },
    update: { lastActivityAt: now }
  });
  if (milestone) {
    await db.quotationTrackingSession.updateMany({
      where: { id: session.id, [milestone]: null },
      data: { [milestone]: now }
    });
  }
  return { sessionId: session.sessionId, visitDate: visitDate.toISOString().slice(0, 10) };
}
