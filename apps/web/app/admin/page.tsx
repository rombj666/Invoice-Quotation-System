"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDashboard, updateQuotationFollowUp, type DashboardPeriod, type FunnelTotals, type TrendPoint } from "../../lib/admin-api";

const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Today" }, { value: "week", label: "This Week" },
  { value: "month", label: "This Month" }, { value: "all", label: "All Time" }
];

function FunnelChart({ data }: { data: FunnelTotals }) {
  if (!data.visitors && !data.started && !data.submitted) return <div className="admin-chart-empty">No funnel activity for this period.</div>;
  const maximum = Math.max(1, data.visitors, data.started, data.submitted);
  return <div className="admin-funnel-chart">
    {(["visitors", "started", "submitted"] as const).map((key) => <div key={key}>
      <span>{key[0].toUpperCase() + key.slice(1)}</span><strong>{data[key]}</strong>
      <i style={{ width: `${Math.max(data[key] ? 10 : 0, (data[key] / maximum) * 100)}%` }} />
    </div>)}
    <p>Not submitted: <strong>{data.notSubmitted}</strong></p>
  </div>;
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  if (!points.length) return <div className="admin-chart-empty">No activity for this period.</div>;
  const max = Math.max(1, ...points.flatMap((point) => [point.visitors, point.started, point.submitted]));
  const width = 720, height = 220, pad = 24;
  const path = (key: "visitors" | "started" | "submitted") => points.map((point, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(1, points.length - 1);
    const y = height - pad - (point[key] / max) * (height - pad * 2);
    return `${index ? "L" : "M"}${x},${y}`;
  }).join(" ");
  return <div className="admin-trend-chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Visitors, starts, and submissions over time">
      <path className="visitors" d={path("visitors")} /><path className="started" d={path("started")} /><path className="submitted" d={path("submitted")} />
    </svg>
    <div className="admin-chart-legend"><span className="visitors">Visitors</span><span className="started">Started</span><span className="submitted">Submitted</span></div>
    <div className="admin-trend-labels"><span>{points[0].label}</span><span>{points.at(-1)?.label}</span></div>
  </div>;
}

export default function AdminHomePage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [data, setData] = useState<Awaited<ReturnType<typeof loadDashboard>> | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try { setData(await loadDashboard(period)); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard."); }
  }
  useEffect(() => { void refresh(); }, [period]);

  async function updateLead(quotationNo: string, status: string, note?: string) {
    try { await updateQuotationFollowUp(quotationNo, status, note); await refresh(); }
    catch (updateError) { setError(updateError instanceof Error ? updateError.message : "Unable to update lead."); }
  }

  const leads = data?.leads ?? { total: 0, new: 0, contacted: 0, converted: 0, followUp: 0, won: 0, lost: 0 };
  const analytics = data?.analytics ?? { visitors: 0, started: 0, inProgress: 0, notSubmitted: 0, submitted: 0, conversionRate: 0 };
  const funnel = data?.funnel ?? { visitors: 0, started: 0, submitted: 0, notSubmitted: 0, inProgress: 0 };
  const resultCount = analytics.submitted + analytics.notSubmitted + analytics.inProgress;
  const totalResults = Math.max(1, resultCount);

  return <main className="admin-page admin-dashboard-page">
    <header className="admin-page-header"><div><p className="admin-eyebrow">Overview</p><h1>Dashboard</h1><p>Lead performance and quotation activity in Asia/Kuala_Lumpur.</p></div>
      <div className="admin-period-filter">{periods.map((item) => <button className={period === item.value ? "active" : ""} type="button" key={item.value} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div>
    </header>
    {error ? <p className="error">{error}</p> : null}
    <section className="admin-metric-grid">
      {[['Total Leads',leads.total],['Not Yet Followed Up',leads.new],['Contacted Leads',leads.contacted],['Converted Leads',leads.converted]].map(([label,value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>
    <section className="admin-dashboard-section"><h2>Website Quotation Activity</h2><div className="admin-activity-grid">
      {[['Page visitors',analytics.visitors],['Started',analytics.started],['Currently completing',analytics.inProgress],['Did not submit',analytics.notSubmitted],['Submitted',analytics.submitted],['Conversion rate',`${analytics.conversionRate}%`]].map(([label,value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </div></section>
    <section className="admin-chart-grid">
      <article><h2>Quotation Funnel</h2><FunnelChart data={funnel} /></article>
      <article className="admin-trend-panel"><h2>Activity Trend</h2><TrendChart points={data?.trend.points ?? []} /></article>
      <article><h2>Submission Result</h2>{resultCount ? <div className="admin-result-chart"><div className="admin-result-donut" style={{ background: `conic-gradient(#2d7a4f 0 ${(analytics.submitted/totalResults)*100}%, #c5843e 0 ${((analytics.submitted+analytics.notSubmitted)/totalResults)*100}%, #8c9ba5 0)` }} /><div><p><i className="submitted" />Submitted <strong>{analytics.submitted}</strong></p><p><i className="abandoned" />Not submitted <strong>{analytics.notSubmitted}</strong></p><p><i className="progress" />Still in progress <strong>{analytics.inProgress}</strong></p></div></div> : <div className="admin-chart-empty">No submission results for this period.</div>}</article>
    </section>
    <section className="admin-dashboard-section"><div className="admin-section-heading"><div><h2>Leads Requiring Follow-up</h2><p>New leads are prioritized, followed by the oldest untouched leads.</p></div><Link href="/admin/quotations">View all quotations</Link></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Quotation number</th><th>Customer</th><th>Phone</th><th>Company</th><th>Submitted date</th><th>Follow-up status</th><th>Action</th></tr></thead><tbody>
        {(data?.queue ?? []).map((lead) => <tr key={lead.quotationNo}><td>{lead.quotationNo}</td><td>{lead.customer}</td><td>{lead.phone}</td><td>{lead.company || '-'}</td><td>{new Date(lead.submittedAt).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'})}</td><td><span className={`admin-status-badge follow-${lead.followUpStatus.toLowerCase()}`}>{lead.followUpStatus.replaceAll('_',' ')}</span></td><td><div className="admin-actions"><Link href={`/admin/quotations/${lead.quotationNo}`}>View</Link><button type="button" onClick={() => updateLead(lead.quotationNo, "CONTACTED", lead.followUpNote)}>Mark Contacted</button><button type="button" onClick={() => { const note=window.prompt('Follow-up note',lead.followUpNote || ''); if(note!==null) void updateLead(lead.quotationNo,lead.followUpStatus,note); }}>Add Follow-up Note</button></div></td></tr>)}
        {!data?.queue.length ? <tr><td colSpan={7}>No leads currently require follow-up</td></tr> : null}
      </tbody></table></div>
    </section>
  </main>;
}
