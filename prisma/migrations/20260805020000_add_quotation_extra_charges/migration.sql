CREATE TABLE "QuotationExtraCharge" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationExtraCharge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuotationExtraCharge_quotationId_idx" ON "QuotationExtraCharge"("quotationId");

ALTER TABLE "QuotationExtraCharge"
ADD CONSTRAINT "QuotationExtraCharge_quotationId_fkey"
FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
