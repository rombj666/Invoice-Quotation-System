import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../utils/prisma";

export const lockedDateRoutes = Router();
export const adminLockedDateRoutes = Router();

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

lockedDateRoutes.get("/", async (_req, res, next) => {
  try {
    const dates = await prisma.lockedDate.findMany({ select: { date: true }, orderBy: { date: "asc" } });
    res.json(dates.map((item) => item.date.toISOString().slice(0, 10)));
  } catch (error) { next(error); }
});

adminLockedDateRoutes.get("/", async (_req, res, next) => {
  try { res.json(await prisma.lockedDate.findMany({ orderBy: { date: "asc" } })); }
  catch (error) { next(error); }
});

adminLockedDateRoutes.post("/", async (req, res, next) => {
  try {
    const { dates, customerName, reference, note } = req.body;
    if (!Array.isArray(dates) || !dates.length || dates.some((date) => !parseDate(date))) {
      return res.status(400).json({ error: "Select one or more valid calendar dates." });
    }
    if ([customerName, reference, note].some((value) => value != null && typeof value !== "string")) {
      return res.status(400).json({ error: "Lock information must be text." });
    }
    const selectedDates = [...new Set<string>(dates)].map((date) => parseDate(date)!);
    const records = await prisma.$transaction(async (tx) => {
      await tx.lockedDate.createMany({
        data: selectedDates.map((date) => ({ date, customerName: customerName?.trim() || null, reference: reference?.trim() || null, note: note?.trim() || null }))
      });
      return tx.lockedDate.findMany({ where: { date: { in: selectedDates } }, orderBy: { date: "asc" } });
    });
    res.status(201).json(records);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ error: "One or more selected dates are already locked. Refresh the calendar and choose unlocked dates." });
    }
    next(error);
  }
});

adminLockedDateRoutes.delete("/:id", async (req, res, next) => {
  try {
    await prisma.lockedDate.deleteMany({ where: { id: String(req.params.id) } });
    res.status(204).end();
  } catch (error) { next(error); }
});
