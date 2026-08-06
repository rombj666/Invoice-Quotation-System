import assert from "node:assert/strict";
import test from "node:test";
import { dashboardMetrics, periodRange } from "../src/routes/admin-dashboard";

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
