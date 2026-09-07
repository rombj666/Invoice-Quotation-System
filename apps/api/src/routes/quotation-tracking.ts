import { Router } from "express";
import { prisma } from "../utils/prisma";
import { isTrackingId, recordQuotationTracking } from "../services/quotation-tracking";

export const quotationTrackingRoutes = Router();

quotationTrackingRoutes.post("/session", async (req, res, next) => {
  try {
    const { visitorId, sessionId, visitDate, event } = req.body;
    if (!isTrackingId(visitorId) || !isTrackingId(sessionId)) {
      return res.status(400).json({ error: "Valid quotation visitor and session IDs are required." });
    }
    if (!["OPEN", "ACTIVITY", "STEP1_ENGAGED", "STEP2_VISITED", "PACKAGE_SELECTED"].includes(event)) {
      return res.status(400).json({ error: "Invalid quotation tracking event." });
    }
    const milestone = event === "STEP1_ENGAGED" ? "step1EngagedAt"
      : event === "STEP2_VISITED" ? "step2VisitedAt"
      : event === "PACKAGE_SELECTED" ? "packageSelectedAt" : undefined;
    const session = await prisma.$transaction((tx) => recordQuotationTracking(tx, { visitorId, sessionId, visitDate }, milestone));
    res.json({ tracked: true, ...session });
  } catch (error) { next(error); }
});
