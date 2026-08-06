"use client";

import { useEffect, useState } from "react";
import { loadDashboard, type DashboardPeriod } from "../../lib/admin-api";

const periods: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "all", label: "All time" }
];

export default function AdminHomePage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [data, setData] = useState({ totalLeads: 0, convertedLeads: 0, pageVisitors: 0, conversionRate: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    loadDashboard(period).then(setData).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard."));
  }, [period]);

  return <main className="admin-page admin-dashboard-page">
    <header className="admin-page-header"><div><p className="admin-eyebrow">Overview</p><h1>Dashboard</h1><p>Submitted lead and anonymous public-page visitor statistics.</p></div>
      <div className="admin-period-filter">{periods.map((item) => <button className={period === item.value ? "active" : ""} type="button" key={item.value} onClick={() => setPeriod(item.value)}>{item.label}</button>)}</div>
    </header>
    {error ? <p className="error">{error}</p> : null}
    <section className="admin-metric-grid">
      {[["Total Leads", data.totalLeads], ["Converted Leads", data.convertedLeads], ["Page Visitors", data.pageVisitors], ["Conversion Rate", `${data.conversionRate}%`]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
    </section>
  </main>;
}
