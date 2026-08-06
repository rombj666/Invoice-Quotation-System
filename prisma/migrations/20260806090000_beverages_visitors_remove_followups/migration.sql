-- Replace the lead follow-up subsystem, add anonymous daily visits, and introduce
-- catalog-backed beverage snapshots without deleting historical drink rows.

CREATE TYPE "DrinkDistributionMode" AS ENUM ('MANUAL', 'HOUR_COFFEE_DECIDES');

ALTER TYPE "InvoiceItemType" ADD VALUE IF NOT EXISTS 'EXTRA_SERVING_HOUR';

CREATE TABLE "Beverage" (
    "id" TEXT NOT NULL,
    "legacyKey" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "publicId" TEXT,
    "icedAvailable" BOOLEAN NOT NULL DEFAULT true,
    "hotAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Beverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Beverage_legacyKey_key" ON "Beverage"("legacyKey");
CREATE INDEX "Beverage_isAvailable_isArchived_displayOrder_idx" ON "Beverage"("isAvailable", "isArchived", "displayOrder");
CREATE INDEX "Beverage_name_idx" ON "Beverage"("name");

-- Stable IDs make the legacy backfill deterministic across every environment.
INSERT INTO "Beverage" ("id", "legacyKey", "name", "icedAvailable", "hotAvailable", "displayOrder") VALUES
  ('bev_americano', 'americano', 'Americano', true, true, 10),
  ('bev_cafe_latte', 'latte', 'Cafe Latte', true, true, 20),
  ('bev_dark_chocolate', 'chocolate', 'Dark Chocolate', true, true, 30),
  ('bev_lemonade', 'lemonade', 'Lemonade', true, false, 40)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "QuotationDate"
ADD COLUMN "distributionMode" "DrinkDistributionMode" NOT NULL DEFAULT 'MANUAL';

UPDATE "QuotationDate" qd
SET "distributionMode" = 'HOUR_COFFEE_DECIDES'
FROM "Quotation" q
WHERE q.id = qd."quotationId"
  AND COALESCE((q.metadata ->> 'letHourCoffeeDecideDrinks')::boolean, false) = true;

ALTER TABLE "QuotationDrink"
ADD COLUMN "beverageId" TEXT,
ADD COLUMN "imageUrlSnapshot" TEXT,
ADD COLUMN "icedAvailableSnapshot" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "hotAvailableSnapshot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isExcluded" BOOLEAN NOT NULL DEFAULT false;

UPDATE "QuotationDrink" qd
SET "beverageId" = b.id,
    "icedAvailableSnapshot" = b."icedAvailable",
    "hotAvailableSnapshot" = b."hotAvailable"
FROM "Beverage" b
WHERE b."legacyKey" = qd."drinkId";

ALTER TABLE "QuotationDrink"
ADD CONSTRAINT "QuotationDrink_beverageId_fkey"
FOREIGN KEY ("beverageId") REFERENCES "Beverage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "QuotationDrink_beverageId_idx" ON "QuotationDrink"("beverageId");
CREATE UNIQUE INDEX "QuotationDrink_quotationDateId_beverageId_key" ON "QuotationDrink"("quotationDateId", "beverageId");

CREATE TABLE "InvoiceDrinkSnapshot" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "serviceDateId" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "beverageId" TEXT,
    "beverageName" TEXT NOT NULL,
    "imageUrlSnapshot" TEXT,
    "icedAvailableSnapshot" BOOLEAN NOT NULL DEFAULT true,
    "hotAvailableSnapshot" BOOLEAN NOT NULL DEFAULT false,
    "iceCups" INTEGER NOT NULL DEFAULT 0,
    "hotCups" INTEGER NOT NULL DEFAULT 0,
    "isExcluded" BOOLEAN NOT NULL DEFAULT false,
    "distributionMode" "DrinkDistributionMode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceDrinkSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InvoiceDrinkSnapshot_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "InvoiceDrinkSnapshot_invoiceId_idx" ON "InvoiceDrinkSnapshot"("invoiceId");
CREATE INDEX "InvoiceDrinkSnapshot_beverageId_idx" ON "InvoiceDrinkSnapshot"("beverageId");
CREATE INDEX "InvoiceDrinkSnapshot_serviceDateId_idx" ON "InvoiceDrinkSnapshot"("serviceDateId");

-- Copy quotation snapshots into invoices that already exist before this migration.
INSERT INTO "InvoiceDrinkSnapshot" (
  "id", "invoiceId", "serviceDateId", "serviceDate", "beverageId", "beverageName",
  "imageUrlSnapshot", "icedAvailableSnapshot", "hotAvailableSnapshot", "iceCups",
  "hotCups", "isExcluded", "distributionMode"
)
SELECT
  'ids_' || md5(i.id || qd.id || qdr.id), i.id, qd.id, qd."serviceDate", qdr."beverageId", qdr."drinkName",
  qdr."imageUrlSnapshot", qdr."icedAvailableSnapshot", qdr."hotAvailableSnapshot", qdr."iceCups",
  qdr."hotCups", qdr."isExcluded", qd."distributionMode"
FROM "Invoice" i
JOIN "QuotationDate" qd ON qd."quotationId" = i."quotationId"
JOIN "QuotationDrink" qdr ON qdr."quotationDateId" = qd.id;

CREATE TABLE "PublicPageVisit" (
    "id" TEXT NOT NULL,
    "anonymousVisitorId" TEXT NOT NULL,
    "visitDate" DATE NOT NULL,
    "pagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicPageVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicPageVisit_anonymousVisitorId_visitDate_pagePath_key"
ON "PublicPageVisit"("anonymousVisitorId", "visitDate", "pagePath");
CREATE INDEX "PublicPageVisit_visitDate_idx" ON "PublicPageVisit"("visitDate");
CREATE INDEX "PublicPageVisit_pagePath_idx" ON "PublicPageVisit"("pagePath");

DROP INDEX IF EXISTS "Quotation_followUpStatus_idx";
ALTER TABLE "Quotation"
DROP COLUMN IF EXISTS "followUpStatus",
DROP COLUMN IF EXISTS "lastFollowedUpAt",
DROP COLUMN IF EXISTS "followUpNote";
DROP TYPE IF EXISTS "FollowUpStatus";
