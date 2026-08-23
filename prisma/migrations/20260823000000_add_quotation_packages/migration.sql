-- CreateEnum
CREATE TYPE "PackageLevel" AS ENUM ('LOW_SPEC', 'MIDDLE_SPEC', 'HIGH_SPEC', 'CUSTOMIZED');

-- CreateTable
CREATE TABLE "QuotationPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "PackageLevel" NOT NULL,
    "briefDescription" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagePerk" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagePerk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuotationPackage_level_key" ON "QuotationPackage"("level");
CREATE INDEX "QuotationPackage_level_idx" ON "QuotationPackage"("level");
CREATE INDEX "PackagePerk_packageId_displayOrder_idx" ON "PackagePerk"("packageId", "displayOrder");

-- AddForeignKey
ALTER TABLE "PackagePerk" ADD CONSTRAINT "PackagePerk_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "QuotationPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the four quotation choices so the redesigned customer flow is usable immediately.
INSERT INTO "QuotationPackage" ("id", "name", "level", "briefDescription", "price", "createdAt", "updatedAt") VALUES
('pkg_low_spec', 'Low Spec', 'LOW_SPEC', 'A polished coffee service with the essentials covered.', 800.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pkg_middle_spec', 'Middle Spec', 'MIDDLE_SPEC', 'An elevated setup with added branding and service touches.', 1200.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pkg_high_spec', 'High Spec', 'HIGH_SPEC', 'A premium event experience with our most requested inclusions.', 1800.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('pkg_customized', 'Customized Package', 'CUSTOMIZED', 'A flexible package for events that need a tailored experience.', 2500.00, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "PackagePerk" ("id", "packageId", "name", "displayOrder", "createdAt", "updatedAt") VALUES
('perk_low_1', 'pkg_low_spec', 'Classic coffee cart setup', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_low_2', 'pkg_low_spec', 'Hour Coffee service team', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_mid_1', 'pkg_middle_spec', 'Branded coffee cart', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_mid_2', 'pkg_middle_spec', 'Curated event menu', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_mid_3', 'pkg_middle_spec', 'Dedicated service team', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_high_1', 'pkg_high_spec', 'Premium branded cart setup', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_high_2', 'pkg_high_spec', 'Custom event menu', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_high_3', 'pkg_high_spec', 'Cup sleeve or sticker customization', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_custom_1', 'pkg_customized', 'Tailored setup and service plan', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_custom_2', 'pkg_customized', 'Custom branding options', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('perk_custom_3', 'pkg_customized', 'Flexible event inclusions', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
