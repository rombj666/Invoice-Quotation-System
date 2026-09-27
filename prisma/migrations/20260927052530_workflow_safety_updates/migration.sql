/*
  Warnings:

  - A unique constraint covering the columns `[submissionToken]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[submissionToken]` on the table `Quotation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuotationStatus" ADD VALUE 'RETURNED_FOR_EDIT';
ALTER TYPE "QuotationStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "Beverage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "submissionToken" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PaymentReceipt" ADD COLUMN     "receiptAccount" TEXT,
ADD COLUMN     "receiptAmount" DECIMAL(10,2),
ADD COLUMN     "receiptBank" TEXT,
ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verificationStatus" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN     "returnReason" TEXT,
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "submissionToken" TEXT,
ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "recipientEmail" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "referenceNo" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_recipientRole_idx" ON "Notification"("recipientRole");

-- CreateIndex
CREATE INDEX "Notification_recipientPhone_idx" ON "Notification"("recipientPhone");

-- CreateIndex
CREATE INDEX "Notification_recipientEmail_idx" ON "Notification"("recipientEmail");

-- CreateIndex
CREATE INDEX "Notification_referenceNo_idx" ON "Notification"("referenceNo");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_submissionToken_key" ON "Invoice"("submissionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_submissionToken_key" ON "Quotation"("submissionToken");
