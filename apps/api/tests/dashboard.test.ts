import assert from "node:assert/strict";
import test from "node:test";
import { dashboardMetrics, dashboardQuotationAnalytics, periodRange } from "../src/routes/admin-dashboard";

test("dashboard conversion is based on converted quotations and returns zero for no leads", () => {
  assert.deepEqual(dashboardMetrics(0, 0, 12), { totalLeads: 0, convertedLeads: 0, pageVisitors: 12, conversionRate: 0 });
  assert.equal(dashboardMetrics(8, 3, 4).conversionRate, 37.5);
});

test("dashboard filters use trailing Malaysia calendar-day windows", () => {
  const now = new Date("2026-08-06T12:00:00.000Z");
  const today = periodRange("today", now);
  const week = periodRange("week", now);
  const month = periodRange("month", now);
  assert.equal((today.to!.getTime() - today.from!.getTime()) / 86_400_000, 1);
  assert.equal((week.to!.getTime() - week.from!.getTime()) / 86_400_000, 7);
  assert.equal((month.to!.getTime() - month.from!.getTime()) / 86_400_000, 30);
});

test("quotation statistics and graph series use operational statuses only", () => {
  const data = dashboardQuotationAnalytics([
    { createdAt: new Date("2026-08-06T01:10:00Z"), status: "PENDING_APPROVAL", invoices: [] },
    { createdAt: new Date("2026-08-06T02:10:00Z"), status: "APPROVED", invoices: [] },
    { createdAt: new Date("2026-08-06T02:30:00Z"), status: "APPROVED", invoices: [{ id: "invoice" }] }
  ], "today");
  assert.deepEqual(data.quotationStats, { submitted: 3, pendingApproval: 1, approved: 2, completedConverted: 1 });
  assert.deepEqual(data.graphs.submittedVsConverted, { submitted: 3, converted: 1 });
  assert.deepEqual(data.graphs.submissions, [{ label: "09:00", value: 1 }, { label: "10:00", value: 2 }]);
  assert.deepEqual(data.graphs.statusBreakdown, [
    { label: "Pending Approval", value: 1 },
    { label: "Approved", value: 1 },
    { label: "Completed / Converted", value: 1 }
  ]);
  assert.equal(JSON.stringify(data).includes("FOLLOW_UP"), false);
});
