import { PackageLevel, Prisma } from "@prisma/client";
import {
  CART_STYLE_LABELS,
  PACKAGE_CODES,
  PACKAGE_OPTION_LABELS,
  PACKAGE_RULES,
  type PackageCode
} from "@hour-coffee/shared";
import { Router } from "express";
import { prisma } from "../utils/prisma";

export const packageRoutes = Router();
export const adminPackageRoutes = Router();

const levelByCode: Record<PackageCode, PackageLevel> = {
  CONFERENCE: PackageLevel.LOW_SPEC,
  EXHIBITOR: PackageLevel.MIDDLE_SPEC,
  BRAND_LAUNCH: PackageLevel.HIGH_SPEC,
  CUSTOMIZE: PackageLevel.CUSTOMIZED
};

const legacyNames = new Set(["Low Spec", "Middle Spec", "High Spec", "Customized Package"]);

function isPackageCode(value: string): value is PackageCode {
  return PACKAGE_CODES.includes(value as PackageCode);
}

function packageDisplay(code: PackageCode, stored?: { id: string; name: string; briefDescription: string | null }) {
  const rule = PACKAGE_RULES[code];
  const useStoredCopy = Boolean(stored && !legacyNames.has(stored.name));
  return {
    id: stored?.id ?? `fixed-${code.toLowerCase()}`,
    code,
    name: useStoredCopy ? stored!.name : rule.name,
    shortDescription: useStoredCopy && stored!.briefDescription ? stored!.briefDescription : rule.shortDescription,
    perDayMoq: rule.perDayMoq,
    includedItems: rule.includedItems,
    availableOptions: rule.availableOptions.map((option) => ({ code: option, label: PACKAGE_OPTION_LABELS[option] })),
    availableCartStyles: rule.availableCartStyles.map((cart) => ({ code: cart, label: CART_STYLE_LABELS[cart] })),
    cartSelectionRequired: rule.cartSelectionRequired,
    defaultCart: rule.defaultCart
  };
}

export async function getFixedPackages() {
  const stored = await prisma.quotationPackage.findMany({
    select: { id: true, level: true, name: true, briefDescription: true }
  });
  return PACKAGE_CODES.map((code) => packageDisplay(code, stored.find((item) => item.level === levelByCode[code])));
}

packageRoutes.get("/", async (_req, res, next) => {
  try {
    res.json(await getFixedPackages());
  } catch (error) {
    next(error);
  }
});

adminPackageRoutes.get("/", async (_req, res, next) => {
  try {
    res.json(await getFixedPackages());
  } catch (error) {
    next(error);
  }
});

adminPackageRoutes.put("/:code", async (req, res, next) => {
  const codeText = String(req.params.code ?? "").toUpperCase();
  if (!isPackageCode(codeText)) return res.status(404).json({ error: "Fixed package not found." });
  const name = String(req.body.name ?? "").trim();
  const shortDescription = String(req.body.shortDescription ?? "").trim();
  if (!name) return res.status(400).json({ error: "Display title is required." });
  if (!shortDescription) return res.status(400).json({ error: "Short description is required." });
  if (name.length > 80 || shortDescription.length > 300) return res.status(400).json({ error: "Package display details are too long." });

  try {
    const level = levelByCode[codeText];
    const stored = await prisma.quotationPackage.upsert({
      where: { level },
      create: { name, level, briefDescription: shortDescription, price: 0 },
      update: { name, briefDescription: shortDescription },
      select: { id: true, name: true, briefDescription: true }
    });
    res.json(packageDisplay(codeText, stored));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "This package display title is already in use." });
    }
    next(error);
  }
});

adminPackageRoutes.post("/", (_req, res) => res.status(405).json({ error: "The four package types are fixed and cannot be created." }));
adminPackageRoutes.delete("/:code", (_req, res) => res.status(405).json({ error: "Fixed package types cannot be deleted." }));
