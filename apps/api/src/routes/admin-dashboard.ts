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

type DashboardQuotation = {
  createdAt: Date;
  status: string;
  invoices: Array<{ id: string }>;
};

function trendKey(createdAt: Date, period: Period): string {
  const malaysiaDate = new Date(createdAt.getTime() + MALAYSIA_OFFSET_MS);
  const year = malaysiaDate.getUTCFullYear();
  const month = String(malaysiaDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(malaysiaDate.getUTCDate()).padStart(2, "0");
  if (period === "today") return `${String(malaysiaDate.getUTCHours()).padStart(2, "0")}:00`;
  if (period === "all") return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

function statusLabel(status: string): string {
  return status.toLowerCase().split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}

export function dashboardQuotationAnalytics(quotations: DashboardQuotation[], period: Period) {
  const converted = quotations.filter((quotation) => quotation.invoices.length > 0);
  const trend = new Map<string, number>();
  const statuses = new Map<string, number>();
  for (const quotation of quotations) {
    const key = trendKey(quotation.createdAt, period);
    trend.set(key, (trend.get(key) ?? 0) + 1);
    const label = quotation.invoices.length > 0 ? "Completed / Converted" : statusLabel(quotation.status);
    statuses.set(label, (statuses.get(label) ?? 0) + 1);
  }
  const preferredStatusOrder = ["Pending Approval", "Approved", "Completed / Converted"];
  const statusBreakdown = [...statuses.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => {
      const aIndex = preferredStatusOrder.indexOf(a.label);
      const bIndex = preferredStatusOrder.indexOf(b.label);
      if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? preferredStatusOrder.length : aIndex) - (bIndex === -1 ? preferredStatusOrder.length : bIndex);
      return a.label.localeCompare(b.label);
    });
  return {
    quotationStats: {
      submitted: quotations.length,
      pendingApproval: quotations.filter((quotation) => quotation.status === "PENDING_APPROVAL").length,
      approved: quotations.filter((quotation) => quotation.status === "APPROVED").length,
      completedConverted: converted.length
    },
    graphs: {
      grouping: period === "today" ? "hour" : period === "all" ? "month" : "day",
      submissions: [...trend.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value })),
      submittedVsConverted: { submitted: quotations.length, converted: converted.length },
      statusBreakdown
    }
  };
}

adminDashboardRoutes.get("/metrics", async (req, res, next) => {
  try {
    const range = periodRange(parsePeriod(req.query.period));
    const createdAt = dateWhere(range);
    // Browser drafts live only in local storage; every persisted quotation has
    // passed submission validation and is therefore a lead, regardless of its
    // later operational status.
    const quotationWhere = createdAt ? { createdAt } : {};
    const [quotations, pageVisitors] = await Promise.all([
      prisma.quotation.findMany({
        where: quotationWhere,
        select: { createdAt: true, status: true, invoices: { select: { id: true }, take: 1 } },
        orderBy: { createdAt: "asc" }
      }),
      prisma.publicPageVisit.count({ where: { pagePath: "/quotation", ...(createdAt ? { createdAt } : {}) } })
    ]);
    const analytics = dashboardQuotationAnalytics(quotations, parsePeriod(req.query.period));
    res.json({ ...dashboardMetrics(quotations.length, analytics.quotationStats.completedConverted, pageVisitors), ...analytics });
  } catch (error) { next(error); }
});
