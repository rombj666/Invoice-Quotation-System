import { FollowUpStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../utils/prisma";

export const adminDashboardRoutes = Router();

type Period = "today" | "week" | "month" | "all";
const MALAYSIA_OFFSET_MS = 8 * 60 * 60 * 1000;

function parsePeriod(value: unknown): Period {
  return value === "today" || value === "week" || value === "month" ? value : "all";
}

export function periodRange(period: Period, now = new Date()): { from?: Date; to?: Date } {
  if (period === "all") return {};
  const malaysiaNow = new Date(now.getTime() + MALAYSIA_OFFSET_MS);
  const year = malaysiaNow.getUTCFullYear();
  const month = malaysiaNow.getUTCMonth();
  const day = malaysiaNow.getUTCDate();
  let startDay = day;
  let endYear = year;
  let endMonth = month;
  let endDay = day + 1;

  if (period === "week") {
    const weekday = malaysiaNow.getUTCDay() || 7;
    startDay = day - weekday + 1;
    endDay = startDay + 7;
  } else if (period === "month") {
    startDay = 1;
    endMonth = month + 1;
    endDay = 1;
  }

  return {
    from: new Date(Date.UTC(year, month, startDay) - MALAYSIA_OFFSET_MS),
    to: new Date(Date.UTC(endYear, endMonth, endDay) - MALAYSIA_OFFSET_MS)
  };
}

function dateWhere(range: { from?: Date; to?: Date }) {
  return range.from && range.to ? { gte: range.from, lt: range.to } : undefined;
}

function countValue(value: bigint | number | undefined): number {
  return Number(value ?? 0);
}

adminDashboardRoutes.get("/lead-totals", async (req, res, next) => {
  try {
    const range = periodRange(parsePeriod(req.query.period));
    const createdAt = dateWhere(range);
    const baseWhere = createdAt ? { createdAt } : {};
    const [total, newLeads, contacted, converted, followUp, won, lost] = await Promise.all([
      prisma.quotation.count({ where: baseWhere }),
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: "NEW" } }),
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: { in: ["CONTACTED", "FOLLOW_UP"] } } }),
      prisma.quotation.count({ where: { ...baseWhere, invoices: { some: {} } } }),
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: "FOLLOW_UP" } }),
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: "WON" } }),
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: "LOST" } })
    ]);
    res.json({ total, new: newLeads, contacted, converted, followUp, won, lost });
  } catch (error) {
    next(error);
  }
});

adminDashboardRoutes.get("/follow-up-totals", async (req, res, next) => {
  try {
    const range = periodRange(parsePeriod(req.query.period));
    const createdAt = dateWhere(range);
    const baseWhere = createdAt ? { createdAt } : {};
    const [newLeads, contacted, followUp, won, lost] = await Promise.all([
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: "NEW" } }),
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: "CONTACTED" } }),
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: "FOLLOW_UP" } }),
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: "WON" } }),
      prisma.quotation.count({ where: { ...baseWhere, followUpStatus: "LOST" } })
    ]);
    res.json({ new: newLeads, contacted, followUp, won, lost });
  } catch (error) {
    next(error);
  }
});

adminDashboardRoutes.get("/analytics-totals", async (req, res, next) => {
  try {
    const range = periodRange(parsePeriod(req.query.period));
    const firstVisitedAt = dateWhere(range);
    const startedAt = dateWhere(range);
    const submittedAt = dateWhere(range);
    const inactiveBefore = new Date(Date.now() - 30 * 60 * 1000);
    const startedBase = startedAt ? { startedAt } : { startedAt: { not: null } };
    const [visitors, started, submitted, inProgress, notSubmitted] = await Promise.all([
      prisma.quotationAnalyticsSession.count({ where: firstVisitedAt ? { firstVisitedAt } : {} }),
      prisma.quotationAnalyticsSession.count({ where: startedAt ? { startedAt } : { startedAt: { not: null } } }),
      prisma.quotationAnalyticsSession.count({ where: submittedAt ? { submittedAt } : { submittedAt: { not: null } } }),
      prisma.quotationAnalyticsSession.count({ where: { ...startedBase, submittedAt: null, lastActivityAt: { gte: inactiveBefore } } }),
      prisma.quotationAnalyticsSession.count({ where: { ...startedBase, submittedAt: null, lastActivityAt: { lt: inactiveBefore } } })
    ]);
    res.json({
      visitors,
      started,
      inProgress,
      notSubmitted,
      submitted,
      conversionRate: started ? Math.round((submitted / started) * 1000) / 10 : 0
    });
  } catch (error) {
    next(error);
  }
});

adminDashboardRoutes.get("/funnel", async (req, res, next) => {
  try {
    const period = parsePeriod(req.query.period);
    const range = periodRange(period);
    const inactiveBefore = new Date(Date.now() - 30 * 60 * 1000);
    const [visitors, started, submitted, notSubmitted, inProgress] = await Promise.all([
      prisma.quotationAnalyticsSession.count({ where: dateWhere(range) ? { firstVisitedAt: dateWhere(range) } : {} }),
      prisma.quotationAnalyticsSession.count({ where: dateWhere(range) ? { startedAt: dateWhere(range) } : { startedAt: { not: null } } }),
      prisma.quotationAnalyticsSession.count({ where: dateWhere(range) ? { submittedAt: dateWhere(range) } : { submittedAt: { not: null } } }),
      prisma.quotationAnalyticsSession.count({ where: { startedAt: dateWhere(range) ?? { not: null }, submittedAt: null, lastActivityAt: { lt: inactiveBefore } } }),
      prisma.quotationAnalyticsSession.count({ where: { startedAt: dateWhere(range) ?? { not: null }, submittedAt: null, lastActivityAt: { gte: inactiveBefore } } })
    ]);
    res.json({ visitors, started, submitted, notSubmitted, inProgress });
  } catch (error) {
    next(error);
  }
});

type TrendRow = { label: string; total: bigint | number };

async function trendFor(field: "firstVisitedAt" | "startedAt" | "submittedAt", period: Period): Promise<TrendRow[]> {
  const range = periodRange(period);
  const unit = period === "today" ? "hour" : period === "all" ? "month" : "day";
  const format = period === "today" ? "YYYY-MM-DD HH24:00" : period === "all" ? "YYYY-MM" : "YYYY-MM-DD";
  const column = Prisma.raw(`"${field}"`);
  const where = range.from && range.to
    ? Prisma.sql`WHERE ${column} IS NOT NULL AND ${column} >= ${range.from} AND ${column} < ${range.to}`
    : Prisma.sql`WHERE ${column} IS NOT NULL`;
  return prisma.$queryRaw<TrendRow[]>(Prisma.sql`
    SELECT to_char(date_trunc(${unit}, ${column} + interval '8 hours'), ${format}) AS label,
           COUNT(*)::int AS total
    FROM "QuotationAnalyticsSession"
    ${where}
    GROUP BY 1
    ORDER BY 1
  `);
}

adminDashboardRoutes.get("/trend", async (req, res, next) => {
  try {
    const period = parsePeriod(req.query.period);
    const [visitors, started, submitted] = await Promise.all([
      trendFor("firstVisitedAt", period),
      trendFor("startedAt", period),
      trendFor("submittedAt", period)
    ]);
    const labels = [...new Set([...visitors, ...started, ...submitted].map((row) => row.label))].sort();
    const mapRows = (rows: TrendRow[]) => new Map(rows.map((row) => [row.label, countValue(row.total)]));
    const visitorMap = mapRows(visitors);
    const startedMap = mapRows(started);
    const submittedMap = mapRows(submitted);
    res.json({
      grouping: period === "today" ? "hour" : period === "all" ? "month" : "day",
      points: labels.map((label) => ({ label, visitors: visitorMap.get(label) ?? 0, started: startedMap.get(label) ?? 0, submitted: submittedMap.get(label) ?? 0 }))
    });
  } catch (error) {
    next(error);
  }
});

adminDashboardRoutes.get("/follow-up-queue", async (req, res, next) => {
  try {
    const range = periodRange(parsePeriod(req.query.period));
    const leads = await prisma.quotation.findMany({
      where: {
        followUpStatus: { in: ["NEW", "FOLLOW_UP"] as FollowUpStatus[] },
        ...(dateWhere(range) ? { createdAt: dateWhere(range) } : {})
      },
      orderBy: [{ followUpStatus: "asc" }, { lastFollowedUpAt: "asc" }, { createdAt: "asc" }],
      take: 10,
      include: { customer: true }
    });
    res.json(leads.map((lead) => ({
      quotationNo: lead.quotationNo,
      customer: lead.customer.name,
      phone: lead.customer.phone,
      company: lead.customer.companyName,
      submittedAt: lead.createdAt.toISOString(),
      followUpStatus: lead.followUpStatus,
      followUpNote: lead.followUpNote
    })));
  } catch (error) {
    next(error);
  }
});
