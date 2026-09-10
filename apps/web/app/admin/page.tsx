"use client";

import { useEffect, useState } from "react";
import { loadDashboard, type DashboardMetrics, type DashboardPeriod, type DashboardPoint, type TrafficCounts, type TrafficPeriod } from "../../lib/admin-api";

const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Today" }, { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" }, { value: "all", label: "All time" }
];

const emptyDashboard: DashboardMetrics = {
  totalLeads: 0, convertedLeads: 0, pageVisitors: 0, conversionRate: 0,
  quotationStats: { submitted: 0, pendingApproval: 0, approved: 0, completedConverted: 0 },
  traffic: {
    grouping: "day",
    current: { from: "", to: "", totals: { sessions: 0, step1Engaged: 0, step2Visitors: 0, packageSelected: 0, submitted: 0, directExit: 0, step1Abandoned: 0, step2Abandoned: 0 }, points: [] },
    previous: null
  },
  graphs: { grouping: "day", submissions: [], submittedVsConverted: { submitted: 0, converted: 0 }, statusBreakdown: [] }
};

function EmptyChart() {
  return <div className="admin-chart-empty">No quotation data is available for this period.</div>;
}

type TrafficMetric = Exclude<keyof TrafficCounts, "step1Abandoned" | "step2Abandoned">;

const trafficMetrics: Array<{ key: TrafficMetric; label: string; tab: string }> = [
  { key: "sessions", label: "Quotation Sessions", tab: "Sessions" },
  { key: "step1Engaged", label: "Step 1 Engaged", tab: "Engaged" },
  { key: "step2Visitors", label: "Step 2 Reached", tab: "Step 2 Reached" },
  { key: "packageSelected", label: "Package Selected", tab: "Package Selected" },
  { key: "submitted", label: "Submitted Quotations", tab: "Submitted" },
  { key: "directExit", label: "Direct Exit", tab: "Direct Exit" }
];

function trafficDateLabel(label: string, grouping: DashboardMetrics["traffic"]["grouping"]) {
  if (grouping === "hour") return label;
  const [year, month, day] = label.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day || 1)).toLocaleDateString("en-GB", {
    timeZone: "UTC", month: "short", ...(grouping === "month" ? { year: "numeric" } : { day: "numeric" })
  });
}

function TrafficTrend({ traffic, metric }: { traffic: DashboardMetrics["traffic"]; metric: TrafficMetric }) {
  const { current, previous, grouping } = traffic;
  if (!current.points.length) return <div className="admin-chart-empty">No quotation traffic is available for this period.</div>;
  const width = 1000, height = 330, left = 58, right = 32, top = 24, bottom = 48;
  const pointCount = Math.max(current.points.length, previous?.points.length || 0);
  const maximum = Math.max(1, ...current.points.map((point) => point.values[metric]), ...(previous?.points.map((point) => point.values[metric]) || []));
  const tickStep = Math.max(1, Math.ceil(maximum / 4));
  const chartMaximum = tickStep * 4;
  const x = (index: number) => left + (pointCount === 1 ? .5 : index / (pointCount - 1)) * (width - left - right);
  const y = (value: number) => height - bottom - value / chartMaximum * (height - top - bottom);
  const labelStep = Math.max(1, Math.ceil((pointCount - 1) / 6));
  const series: Array<{ data: TrafficPeriod; name: string; className: string }> = [
    { data: current, name: "Current period", className: "current" },
    ...(previous ? [{ data: previous, name: "Previous period", className: "previous" }] : [])
  ];
  const metricLabel = trafficMetrics.find((item) => item.key === metric)!.label;
  return <>
    <div className="admin-traffic-chart-heading"><h3>{metricLabel}</h3><span>{grouping === "hour" ? "Hourly" : grouping === "day" ? "Daily" : "Monthly"}</span></div>
    <div className="admin-traffic-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metricLabel}: current period${previous ? " compared with the previous equivalent period" : ""}`}>
        <title>{metricLabel} over time</title>
        {[0, 1, 2, 3, 4].map((tick) => <g key={tick}>
          <line className="admin-traffic-gridline" x1={left} y1={y(tick * tickStep)} x2={width - right} y2={y(tick * tickStep)} />
          <text className="admin-traffic-axis" x={left - 14} y={y(tick * tickStep) + 4} textAnchor="end">{(tick * tickStep).toLocaleString()}</text>
        </g>)}
        {current.points.map((point, index) => index % labelStep === 0 || index === current.points.length - 1 ? <text className="admin-traffic-axis" key={point.label} x={x(index)} y={height - 18} textAnchor="middle">{trafficDateLabel(point.label, grouping)}</text> : null)}
        {series.map(({ data: periodData, name, className }) => <g key={className} className={`admin-traffic-series ${className}`}>
          <path d={periodData.points.map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.values[metric])}`).join(" ")} />
          {periodData.points.map((point, index) => <circle key={point.label} cx={x(index)} cy={y(point.values[metric])} r={pointCount === 1 ? 5 : 2.5}>
            <title>{name}, {point.label}: {point.values[metric].toLocaleString()}</title>
          </circle>)}
        </g>)}
      </svg>
    </div>
    <div className="admin-traffic-legend">{series.map(({ data: periodData, name, className }) => <span key={className}>
      <i className={className} aria-hidden="true" />{name}{grouping === "day" ? ` (${periodData.points[0]?.label} – ${periodData.points.at(-1)?.label})` : ""}
    </span>)}</div>
  </>;
}

function QuotationTraffic({ traffic, loading }: { traffic: DashboardMetrics["traffic"]; loading: boolean }) {
  const [metric, setMetric] = useState<TrafficMetric>("sessions");
  return <section className="admin-dashboard-chart-panel admin-traffic-panel" aria-labelledby="quotation-traffic-heading" aria-busy={loading}>
    <h2 id="quotation-traffic-heading">Quotation Traffic</h2>
    <div className="admin-traffic-metrics">{trafficMetrics.filter((item) => item.key !== "packageSelected" && item.key !== "directExit").map((item) => <button key={item.key} type="button" aria-pressed={metric === item.key} onClick={() => setMetric(item.key)}>
      <span>{item.label}</span><strong>{loading ? "—" : traffic.current.totals[item.key].toLocaleString()}</strong>
      {!loading && traffic.previous ? <small>Previous: {traffic.previous.totals[item.key].toLocaleString()}</small> : null}
    </button>)}</div>
    <div className="admin-traffic-tabs" role="group" aria-label="Quotation traffic graph metric">{trafficMetrics.map((item) => <button key={item.key} type="button" aria-pressed={metric === item.key} onClick={() => setMetric(item.key)}>{item.tab}</button>)}</div>
    {loading ? <div className="admin-chart-empty">Loading quotation traffic…</div> : <>
      <TrafficTrend traffic={traffic} metric={metric} />
      <div className="admin-traffic-abandonment"><span>Step 1 Abandoned <strong>{traffic.current.totals.step1Abandoned.toLocaleString()}</strong></span><span>Step 2 Abandoned <strong>{traffic.current.totals.step2Abandoned.toLocaleString()}</strong></span></div>
      <p className="admin-traffic-note">One session per visitor per Malaysia calendar day. All funnel stages are grouped by when the session first opened; later stages also qualify for earlier stages. Direct exits and abandonment are counted only after the visit day ends.</p>
    </>}
  </section>;
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
    let cancelled = false;
    setLoading(true); setError("");
    loadDashboard(period).then((dashboard) => {
      if (!cancelled) setData(dashboard);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
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
    <QuotationTraffic traffic={data.traffic} loading={loading} />
    <section className="admin-dashboard-chart-panel"><h2>Submitted Versus Converted Leads</h2>{loading ? <div className="admin-chart-empty">Loading quotation data…</div> : <ComparisonChart submitted={data.graphs.submittedVsConverted.submitted} converted={data.graphs.submittedVsConverted.converted} />}</section>
    <section className="admin-dashboard-chart-panel"><h2>Quotation Status Breakdown</h2>{loading ? <div className="admin-chart-empty">Loading quotation data…</div> : <StatusBreakdown points={data.graphs.statusBreakdown} />}</section>
  </main>;
}
