BEGIN;

-- Only the obsolete analytics data is intentionally removed.
DROP TABLE "QuotationAnalyticsSession";
DROP TABLE "PublicPageVisit";

CREATE TABLE "QuotationTrackingSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "visitDate" DATE NOT NULL,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "step1EngagedAt" TIMESTAMP(3),
    "step2VisitedAt" TIMESTAMP(3),
    "packageSelectedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuotationTrackingSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuotationTrackingSession_sessionId_key" ON "QuotationTrackingSession"("sessionId");
CREATE UNIQUE INDEX "QuotationTrackingSession_visitorId_visitDate_key" ON "QuotationTrackingSession"("visitorId", "visitDate");
CREATE INDEX "QuotationTrackingSession_visitDate_idx" ON "QuotationTrackingSession"("visitDate");
CREATE INDEX "QuotationTrackingSession_visitorId_idx" ON "QuotationTrackingSession"("visitorId");
CREATE INDEX "QuotationTrackingSession_step1EngagedAt_idx" ON "QuotationTrackingSession"("step1EngagedAt");
CREATE INDEX "QuotationTrackingSession_step2VisitedAt_idx" ON "QuotationTrackingSession"("step2VisitedAt");
CREATE INDEX "QuotationTrackingSession_packageSelectedAt_idx" ON "QuotationTrackingSession"("packageSelectedAt");
CREATE INDEX "QuotationTrackingSession_submittedAt_idx" ON "QuotationTrackingSession"("submittedAt");

CREATE TABLE "LockedDate" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "customerName" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LockedDate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LockedDate_date_key" ON "LockedDate"("date");
CREATE INDEX "LockedDate_date_idx" ON "LockedDate"("date");

COMMIT;
