CREATE TABLE "QuotationExtraChargeDate" (
    "id" TEXT NOT NULL,
    "extraChargeId" TEXT NOT NULL,
    "quotationDateId" TEXT NOT NULL,
    CONSTRAINT "QuotationExtraChargeDate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuotationExtraChargeDate_extraChargeId_quotationDateId_key" ON "QuotationExtraChargeDate"("extraChargeId", "quotationDateId");
CREATE INDEX "QuotationExtraChargeDate_quotationDateId_idx" ON "QuotationExtraChargeDate"("quotationDateId");
ALTER TABLE "QuotationExtraChargeDate" ADD CONSTRAINT "QuotationExtraChargeDate_extraChargeId_fkey" FOREIGN KEY ("extraChargeId") REFERENCES "QuotationExtraCharge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuotationExtraChargeDate" ADD CONSTRAINT "QuotationExtraChargeDate_quotationDateId_fkey" FOREIGN KEY ("quotationDateId") REFERENCES "QuotationDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
