import { Router } from "express";
import { prisma } from "../utils/prisma";
import { malaysiaVisitDate } from "../services/quotation-tracking";

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

type TrafficCounts = {
  sessions: number;
  step1Engaged: number;
  step2Visitors: number;
  packageSelected: number;
  submitted: number;
  directExit: number;
  step1Abandoned: number;
  step2Abandoned: number;
};

type DashboardTrafficSession = {
  id: string;
  visitDate: Date;
  firstVisitedAt: Date;
  step1EngagedAt: Date | null;
  step2VisitedAt: Date | null;
  packageSelectedAt: Date | null;
  submittedAt: Date | null;
};

function emptyTrafficCounts(): TrafficCounts {
  return { sessions: 0, step1Engaged: 0, step2Visitors: 0, packageSelected: 0, submitted: 0, directExit: 0, step1Abandoned: 0, step2Abandoned: 0 };
}

function trafficPeriod(sessions: DashboardTrafficSession[], period: Period, from: Date, to: Date, now: Date) {
  const totals = emptyTrafficCounts();
  const buckets = new Map<string, TrafficCounts>();
  for (let cursor = from; cursor < to;) {
    buckets.set(trendKey(cursor, period), emptyTrafficCounts());
    if (period === "all") {
      const malaysiaDate = new Date(cursor.getTime() + MALAYSIA_OFFSET_MS);
      cursor = new Date(Date.UTC(malaysiaDate.getUTCFullYear(), malaysiaDate.getUTCMonth() + 1, 1) - MALAYSIA_OFFSET_MS);
    } else {
      cursor = new Date(cursor.getTime() + (period === "today" ? 1 : 24) * 60 * 60 * 1000);
    }
  }

  function count(metric: keyof TrafficCounts, timestamp: Date | null) {
    if (!timestamp || timestamp < from || timestamp >= to) return;
    const bucket = buckets.get(trendKey(timestamp, period));
    if (!bucket) return;
    totals[metric] += 1;
    bucket[metric] += 1;
  }
  const today = malaysiaVisitDate(now);
  const seen = new Set<string>();
  for (const session of sessions) {
    if (seen.has(session.id)) continue;
    seen.add(session.id);
    // All stages use the session-start cohort, including historical records whose
    // earlier events are missing. Later milestones are evidence of progression.
    const submitted = session.submittedAt !== null;
    const selected = session.packageSelectedAt !== null || submitted;
    const reachedStep2 = session.step2VisitedAt !== null || selected;
    const engaged = session.step1EngagedAt !== null || reachedStep2;
    const startedAt = session.firstVisitedAt;
    count("sessions", startedAt);
    if (engaged) count("step1Engaged", startedAt);
    if (reachedStep2) count("step2Visitors", startedAt);
    if (selected) count("packageSelected", startedAt);
    if (submitted) count("submitted", startedAt);
    if (session.visitDate >= today) continue;
    if (!engaged) count("directExit", startedAt);
    if (engaged && !reachedStep2) count("step1Abandoned", startedAt);
    if (reachedStep2 && !submitted) count("step2Abandoned", startedAt);
  }
  return { from: from.toISOString(), to: to.toISOString(), totals, points: [...buckets].map(([label, values]) => ({ label, values })) };
}

export function dashboardTrafficAnalytics(sessions: DashboardTrafficSession[], period: Period, now = new Date()) {
  let from: Date;
  let to: Date;
  if (period === "all") {
    const firstVisit = sessions.reduce((earliest, session) => session.firstVisitedAt < earliest ? session.firstVisitedAt : earliest, now);
    const malaysiaFirstVisit = new Date(firstVisit.getTime() + MALAYSIA_OFFSET_MS);
    const malaysiaNow = new Date(now.getTime() + MALAYSIA_OFFSET_MS);
    from = new Date(Date.UTC(malaysiaFirstVisit.getUTCFullYear(), malaysiaFirstVisit.getUTCMonth(), 1) - MALAYSIA_OFFSET_MS);
    to = new Date(Date.UTC(malaysiaNow.getUTCFullYear(), malaysiaNow.getUTCMonth() + 1, 1) - MALAYSIA_OFFSET_MS);
  } else {
    const range = periodRange(period, now);
    from = range.from!;
    to = range.to!;
  }
  return {
    grouping: period === "today" ? "hour" : period === "all" ? "month" : "day",
    current: trafficPeriod(sessions, period, from, to, now),
    previous: period === "week" || period === "month"
      ? trafficPeriod(sessions, period, new Date(from.getTime() - (to.getTime() - from.getTime())), from, now)
      : null
  };
}

adminDashboardRoutes.get("/metrics", async (req, res, next) => {
  try {
    const period = parsePeriod(req.query.period);
    const now = new Date();
    const range = periodRange(period, now);
    const createdAt = dateWhere(range);
    const trafficFrom = range.from && range.to && (period === "week" || period === "month")
      ? new Date(range.from.getTime() - (range.to.getTime() - range.from.getTime()))
      : range.from;
    // Browser drafts live only in local storage; every persisted quotation has
    // passed submission validation and is therefore a lead, regardless of its
    // later operational status.
    const quotationWhere = createdAt ? { createdAt } : {};
    const trafficDateRange = dateWhere({ from: trafficFrom, to: range.to });
    const [quotations, trafficSessions] = await Promise.all([
      prisma.quotation.findMany({
        where: quotationWhere,
        select: { createdAt: true, status: true, invoices: { select: { id: true }, take: 1 } },
        orderBy: { createdAt: "asc" }
      }),
      prisma.quotationTrackingSession.findMany({
        where: trafficDateRange ? { firstVisitedAt: trafficDateRange } : {},
        select: {
          id: true,
          visitDate: true,
          firstVisitedAt: true,
          step1EngagedAt: true,
          step2VisitedAt: true,
          packageSelectedAt: true,
          submittedAt: true
        }
      })
    ]);
    const analytics = dashboardQuotationAnalytics(quotations, period);
    const traffic = dashboardTrafficAnalytics(trafficSessions, period, now);
    res.json({ ...dashboardMetrics(quotations.length, analytics.quotationStats.completedConverted, traffic.current.totals.sessions), ...analytics, traffic });
  } catch (error) { next(error); }
});
