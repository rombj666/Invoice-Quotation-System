import { PackageLevel, Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../utils/prisma";

export const packageRoutes = Router();
export const adminPackageRoutes = Router();

const levels = Object.values(PackageLevel);
const includePerks = { perks: { orderBy: { displayOrder: "asc" as const } } };

function serializePackage(item: any) {
  return { ...item, price: Number(item.price) };
}

function parsePackageInput(body: any) {
  const name = String(body.name ?? "").trim();
  const level = String(body.level ?? "") as PackageLevel;
  const briefDescription = String(body.briefDescription ?? "").trim() || null;
  const price = Number(body.price);
  const rawPerks = Array.isArray(body.perks) ? body.perks : [];
  const perks = rawPerks.map((perk: unknown) => String(perk).trim()).filter(Boolean);

  if (!name) return { error: "Package name is required." } as const;
  if (!levels.includes(level)) return { error: "Choose a valid package level." } as const;
  if (!Number.isFinite(price) || price < 0 || !/^\d+(\.\d{1,2})?$/.test(String(body.price))) {
    return { error: "Enter a valid non-negative package price with no more than 2 decimal places." } as const;
  }
  if (perks.some((perk: string) => /^(total\s+)?cups?(\s+quantity)?$/i.test(perk))) {
    return { error: "Cups are set by the customer and cannot be added as a package perk." } as const;
  }
  if (new Set(perks.map((perk: string) => perk.toLowerCase())).size !== perks.length) {
    return { error: "Package perks must be unique." } as const;
  }

  return { data: { name, level, briefDescription, price, perks } } as const;
}

function packageConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

packageRoutes.get("/", async (_req, res, next) => {
  try {
    const items = await prisma.quotationPackage.findMany({ include: includePerks, orderBy: { level: "asc" } });
    res.json(items.map(serializePackage));
  } catch (error) {
    next(error);
  }
});

adminPackageRoutes.get("/", async (_req, res, next) => {
  try {
    const items = await prisma.quotationPackage.findMany({ include: includePerks, orderBy: { level: "asc" } });
    res.json(items.map(serializePackage));
  } catch (error) {
    next(error);
  }
});

adminPackageRoutes.post("/", async (req, res, next) => {
  const parsed = parsePackageInput(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  try {
    const item = await prisma.quotationPackage.create({
      data: {
        name: parsed.data.name,
        level: parsed.data.level,
        briefDescription: parsed.data.briefDescription,
        price: parsed.data.price,
        perks: { create: parsed.data.perks.map((name: string, displayOrder: number) => ({ name, displayOrder })) }
      },
      include: includePerks
    });
    res.status(201).json(serializePackage(item));
  } catch (error) {
    if (packageConflict(error)) return res.status(409).json({ error: "A package already exists for this level. Edit or delete it first." });
    next(error);
  }
});

adminPackageRoutes.put("/:id", async (req, res, next) => {
  const parsed = parsePackageInput(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  try {
    const item = await prisma.quotationPackage.update({
      where: { id: req.params.id },
      data: {
        name: parsed.data.name,
        level: parsed.data.level,
        briefDescription: parsed.data.briefDescription,
        price: parsed.data.price,
        perks: {
          deleteMany: {},
          create: parsed.data.perks.map((name: string, displayOrder: number) => ({ name, displayOrder }))
        }
      },
      include: includePerks
    });
    res.json(serializePackage(item));
  } catch (error) {
    if (packageConflict(error)) return res.status(409).json({ error: "A package already exists for this level." });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return res.status(404).json({ error: "Package not found." });
    next(error);
  }
});

adminPackageRoutes.delete("/:id", async (req, res, next) => {
  try {
    await prisma.quotationPackage.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return res.status(404).json({ error: "Package not found." });
    next(error);
  }
});
