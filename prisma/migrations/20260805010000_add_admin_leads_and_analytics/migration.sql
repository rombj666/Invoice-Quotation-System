CREATE TYPE "FollowUpStatus" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'WON', 'LOST');

ALTER TABLE "Quotation"
ADD COLUMN "followUpStatus" "FollowUpStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "lastFollowedUpAt" TIMESTAMP(3),
ADD COLUMN "followUpNote" TEXT;

ALTER TABLE "StatusHistory"
ADD COLUMN "changeSummary" TEXT;

CREATE TABLE "QuotationAnalyticsSession" (
  "id" TEXT NOT NULL,
  "anonymousSessionId" TEXT NOT NULL,
  "firstVisitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "lastStep" INTEGER,
  "quotationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuotationAnalyticsSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuotationAnalyticsSession_anonymousSessionId_key" ON "QuotationAnalyticsSession"("anonymousSessionId");
CREATE UNIQUE INDEX "QuotationAnalyticsSession_quotationId_key" ON "QuotationAnalyticsSession"("quotationId");
CREATE INDEX "Quotation_followUpStatus_idx" ON "Quotation"("followUpStatus");
CREATE INDEX "QuotationAnalyticsSession_firstVisitedAt_idx" ON "QuotationAnalyticsSession"("firstVisitedAt");
CREATE INDEX "QuotationAnalyticsSession_lastActivityAt_idx" ON "QuotationAnalyticsSession"("lastActivityAt");
CREATE INDEX "QuotationAnalyticsSession_startedAt_idx" ON "QuotationAnalyticsSession"("startedAt");
CREATE INDEX "QuotationAnalyticsSession_submittedAt_idx" ON "QuotationAnalyticsSession"("submittedAt");

ALTER TABLE "QuotationAnalyticsSession"
ADD CONSTRAINT "QuotationAnalyticsSession_quotationId_fkey"
FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
