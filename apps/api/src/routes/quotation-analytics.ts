import { Router } from "express";
import { prisma } from "../utils/prisma";

export const quotationAnalyticsRoutes = Router();

function isAnonymousSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function malaysiaVisitDate(now: Date): Date {
  const malaysia = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return new Date(Date.UTC(malaysia.getUTCFullYear(), malaysia.getUTCMonth(), malaysia.getUTCDate()));
}

function isLocalRequest(req: any): boolean {
  if ((process.env.NODE_ENV ?? "development") === "development") return true;
  const source = String(req.get("origin") ?? req.get("referer") ?? "");
  if (!source) return false;
  try {
    const hostname = new URL(source).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".local");
  } catch { return true; }
}

quotationAnalyticsRoutes.post("/session", async (req, res, next) => {
  try {
    const { anonymousSessionId, anonymousVisitorId = anonymousSessionId, event, lastStep, pagePath = "/quotation" } = req.body;
    if (!isAnonymousSessionId(anonymousSessionId)) {
      return res.status(400).json({ error: "A valid anonymous session ID is required." });
    }
    if (!["OPEN", "START", "ACTIVITY"].includes(event)) {
      return res.status(400).json({ error: "Invalid analytics event." });
    }

    const now = new Date();
    if (event === "OPEN" && pagePath === "/quotation" && isAnonymousSessionId(anonymousVisitorId) && !isLocalRequest(req)) {
      await prisma.publicPageVisit.upsert({
        where: { anonymousVisitorId_visitDate_pagePath: { anonymousVisitorId, visitDate: malaysiaVisitDate(now), pagePath } },
        create: { anonymousVisitorId, visitDate: malaysiaVisitDate(now), pagePath },
        update: {}
      });
    }
    await prisma.quotationAnalyticsSession.upsert({
      where: { anonymousSessionId },
      create: {
        anonymousSessionId,
        firstVisitedAt: now,
        lastActivityAt: now,
        startedAt: null,
        lastStep: Number.isInteger(lastStep) ? Math.max(0, lastStep) : null
      },
      update: {
        lastActivityAt: now,
        ...(Number.isInteger(lastStep) ? { lastStep: Math.max(0, lastStep) } : {})
      }
    });

    if (event === "START" || event === "ACTIVITY") {
      await prisma.quotationAnalyticsSession.updateMany({
        where: { anonymousSessionId, startedAt: null },
        data: { startedAt: now }
      });
    }

    res.json({ tracked: true });
  } catch (error) {
    next(error);
  }
});
