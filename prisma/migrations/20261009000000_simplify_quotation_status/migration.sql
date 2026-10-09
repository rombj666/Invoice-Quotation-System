-- Normalize legacy quotation statuses, then replace the PostgreSQL enum.
-- A completed final customization submission is authoritative even if its
-- quotation had not yet been advanced to the old converted status.
ALTER TABLE "Quotation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Quotation" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

UPDATE "Quotation" AS quotation
SET "status" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "Invoice" AS invoice
    WHERE invoice."quotationId" = quotation."id"
      AND invoice."metadata" #>> '{customizationSubmission,submittedAt}' IS NOT NULL
  ) THEN 'COMPLETED'
  WHEN quotation."status" = 'CONVERTED_TO_INVOICE'
    OR EXISTS (SELECT 1 FROM "Invoice" AS invoice WHERE invoice."quotationId" = quotation."id") THEN 'GENERATED_INVOICE'
  ELSE 'PENDING_APPROVAL'
END;

DROP TYPE "QuotationStatus";
CREATE TYPE "QuotationStatus" AS ENUM ('PENDING_APPROVAL', 'GENERATED_INVOICE', 'COMPLETED');

ALTER TABLE "Quotation"
  ALTER COLUMN "status" TYPE "QuotationStatus" USING "status"::"QuotationStatus",
  ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';
