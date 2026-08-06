"use client";

import { useEffect, useState } from "react";
import { loadDashboard, type DashboardMetrics, type DashboardPeriod, type DashboardPoint } from "../../lib/admin-api";

const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Today" }, { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" }, { value: "all", label: "All time" }
];

const emptyDashboard: DashboardMetrics = {
  totalLeads: 0, convertedLeads: 0, pageVisitors: 0, conversionRate: 0,
  quotationStats: { submitted: 0, pendingApproval: 0, approved: 0, completedConverted: 0 },
  graphs: { grouping: "day", submissions: [], submittedVsConverted: { submitted: 0, converted: 0 }, statusBreakdown: [] }
};

function EmptyChart() {
  return <div className="admin-chart-empty">No quotation data is available for this period.</div>;
}

function SubmissionTrend({ points }: { points: DashboardPoint[] }) {
  if (!points.length) return <EmptyChart />;
  const width = 760, height = 230, horizontalPadding = 34, verticalPadding = 28;
  const maximum = Math.max(1, ...points.map((point) => point.value));
  const coordinates = points.map((point, index) => ({
    ...point,
    x: horizontalPadding + index * (width - horizontalPadding * 2) / Math.max(1, points.length - 1),
    y: height - verticalPadding - point.value / maximum * (height - verticalPadding * 2)
  }));
  const path = coordinates.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  return <div className="admin-quotation-trend">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Quotation submissions over time">
      <line x1={horizontalPadding} y1={height - verticalPadding} x2={width - horizontalPadding} y2={height - verticalPadding} />
      <path d={path} />
      {coordinates.map((point) => <g key={point.label}><circle cx={point.x} cy={point.y} r="5" /><text x={point.x} y={point.y - 11} textAnchor="middle">{point.value}</text></g>)}
    </svg>
    <div className="admin-trend-labels"><span>{points[0].label}</span>{points.length > 1 ? <span>{points.at(-1)?.label}</span> : null}</div>
  </div>;
}

function ComparisonChart({ submitted, converted }: { submitted: number; converted: number }) {
  if (!submitted) return <EmptyChart />;
  const maximum = Math.max(1, submitted, converted);
  return <div className="admin-comparison-chart">
    {[{ label: "Submitted", value: submitted, className: "submitted" }, { label: "Converted", value: converted, className: "converted" }].map((item) => <div key={item.label}><span>{item.label}</span><div><i className={item.className} style={{ width: `${item.value / maximum * 100}%` }} /></div><strong>{item.value}</strong></div>)}
  </div>;
}

function StatusBreakdown({ points }: { points: DashboardPoint[] }) {
  if (!points.length) return <EmptyChart />;
  const maximum = Math.max(1, ...points.map((point) => point.value));
  return <div className="admin-status-chart">{points.map((point, index) => <div key={point.label}><span>{point.label}</span><div><i style={{ width: `${point.value / maximum * 100}%` }} data-color={index % 4} /></div><strong>{point.value}</strong></div>)}</div>;
}

export default function AdminHomePage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [data, setData] = useState<DashboardMetrics>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true); setError("");
    loadDashboard(period).then(setData).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.")).finally(() => setLoading(false));
  }, [period]);

  return <main className="admin-page admin-dashboard-page">
    <header className="admin-page-header"><div><p className="admin-eyebrow">Overview</p><h1>Dashboard</h1><p>Lead performance and operational quotation analytics.</p></div>
      <div className="admin-period-filter" aria-label="Dashboard date range">{periods.map((item) => <button className={period === item.value ? "active" : ""} type="button" key={item.value} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div>
    </header>
    {error ? <p className="error">{error}</p> : null}
    <section aria-labelledby="lead-analytics-heading"><h2 id="lead-analytics-heading" className="admin-section-title">Lead Analytics</h2><div className="admin-metric-grid">
      {[["Total Leads", data.totalLeads], ["Converted Leads", data.convertedLeads], ["Page Visitors", data.pageVisitors], ["Conversion Rate", `${data.conversionRate}%`]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </div></section>
    <section aria-labelledby="quotation-statistics-heading"><h2 id="quotation-statistics-heading" className="admin-section-title">Quotation Statistics</h2><div className="admin-metric-grid quotation-stat-grid">
      {[["Submitted Quotations", data.quotationStats.submitted], ["Pending Approval", data.quotationStats.pendingApproval], ["Approved Quotations", data.quotationStats.approved], ["Completed / Converted Quotations", data.quotationStats.completedConverted]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </div></section>
    <section className="admin-dashboard-chart-panel"><h2>Quotation Submissions Over Time</h2>{loading ? <div className="admin-chart-empty">Loading quotation data…</div> : <SubmissionTrend points={data.graphs.submissions} />}</section>
    <section className="admin-dashboard-chart-panel"><h2>Submitted Versus Converted Leads</h2>{loading ? <div className="admin-chart-empty">Loading quotation data…</div> : <ComparisonChart submitted={data.graphs.submittedVsConverted.submitted} converted={data.graphs.submittedVsConverted.converted} />}</section>
    <section className="admin-dashboard-chart-panel"><h2>Quotation Status Breakdown</h2>{loading ? <div className="admin-chart-empty">Loading quotation data…</div> : <StatusBreakdown points={data.graphs.statusBreakdown} />}</section>
  </main>;
}
