import { Router } from "express";
import { prisma } from "../utils/prisma";

export const adminDashboardRoutes = Router();

export type Period = "today" | "week" | "month" | "all";
const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;

function parsePeriod(value: unknown): Period {
  return value === "today" || value === "week" || value === "month" ? value : "all";
}

export function periodRange(period: Period, now = new Date()): { from?: Date; to?: Date } {
  if (period === "all") return {};
  const malaysiaNow = new Date(now.getTime() + MALAYSIA_OFFSET_MS);
  const todayStartUtc = Date.UTC(malaysiaNow.getUTCFullYear(), malaysiaNow.getUTCMonth(), malaysiaNow.getUTCDate()) - MALAYSIA_OFFSET_MS;
  const days = period === "today" ? 1 : period === "week" ? 7 : 30;
  return { from: new Date(todayStartUtc - (days - 1) * 24 * 60 * 60 * 1000), to: new Date(todayStartUtc + 24 * 60 * 60 * 1000) };
}

function dateWhere(range: { from?: Date; to?: Date }) {
  return range.from && range.to ? { gte: range.from, lt: range.to } : undefined;
}

export function dashboardMetrics(totalLeads: number, convertedLeads: number, pageVisitors: number) {
  return { totalLeads, convertedLeads, pageVisitors, conversionRate: totalLeads ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0 };
}

adminDashboardRoutes.get("/metrics", async (req, res, next) => {
  try {
    const range = periodRange(parsePeriod(req.query.period));
    const createdAt = dateWhere(range);
    // Browser drafts live only in local storage; every persisted quotation has
    // passed submission validation and is therefore a lead, regardless of its
    // later operational status.
    const quotationWhere = createdAt ? { createdAt } : {};
    const [totalLeads, convertedLeads, pageVisitors] = await Promise.all([
      prisma.quotation.count({ where: quotationWhere }),
      prisma.quotation.count({ where: { ...quotationWhere, invoices: { some: {} } } }),
      prisma.publicPageVisit.count({ where: { pagePath: "/quotation", ...(createdAt ? { createdAt } : {}) } })
    ]);
    res.json(dashboardMetrics(totalLeads, convertedLeads, pageVisitors));
  } catch (error) { next(error); }
});
