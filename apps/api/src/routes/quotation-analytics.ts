import { Router } from "express";
import { prisma } from "../utils/prisma";

export const quotationAnalyticsRoutes = Router();

function isAnonymousSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

quotationAnalyticsRoutes.post("/session", async (req, res, next) => {
  try {
    const { anonymousSessionId, event, lastStep } = req.body;
    if (!isAnonymousSessionId(anonymousSessionId)) {
      return res.status(400).json({ error: "A valid anonymous session ID is required." });
    }
    if (!["OPEN", "START", "ACTIVITY"].includes(event)) {
      return res.status(400).json({ error: "Invalid analytics event." });
    }

    const now = new Date();
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
