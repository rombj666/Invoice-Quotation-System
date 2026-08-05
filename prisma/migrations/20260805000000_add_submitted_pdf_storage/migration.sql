ALTER TABLE "Quotation"
ADD COLUMN "quotationPdfUrl" TEXT,
ADD COLUMN "quotationPdfPublicId" TEXT;

ALTER TABLE "Invoice"
ADD COLUMN "invoicePdfPublicId" TEXT;
