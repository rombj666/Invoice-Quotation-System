"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { Button } from "../../../components/common/Button";
import { loadAdminLockedDates, lockDates, unlockDate, type LockedDate } from "../../../lib/locked-dates";

function dateLabel(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default function LockDatesPage() {
  const [month, setMonth] = useState(() => {
    const malaysia = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return new Date(Date.UTC(malaysia.getUTCFullYear(), malaysia.getUTCMonth(), 1));
  });
  const [records, setRecords] = useState<LockedDate[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [inspectedDate, setInspectedDate] = useState<string | null>(null);
  const [draft, setDraft] = useState({ customerName: "", reference: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadAdminLockedDates().then(setRecords).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load locked dates.")).finally(() => setLoading(false));
  }, []);

  const locks = new Map(records.map((item) => [item.date.slice(0, 10), item]));
  const inspected = inspectedDate ? locks.get(inspectedDate) : undefined;
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const leading = month.getUTCDay();
  const cells = Array.from({ length: Math.ceil((leading + days) / 7) * 7 }, (_, index) => {
    const day = index - leading + 1;
    return day > 0 && day <= days ? new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day)).toISOString().slice(0, 10) : "";
  });

  function selectDate(date: string) {
    setError(""); setSuccess("");
    if (locks.has(date)) { setInspectedDate(date); return; }
    setInspectedDate(null);
    setSelected((current) => current.includes(date) ? current.filter((item) => item !== date) : [...current, date].sort());
  }

  async function save() {
    if (!selected.length || busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const saved = await lockDates({ dates: selected, ...draft });
      setRecords((current) => [...current, ...saved]); setSelected([]);
      setSuccess(`${saved.length} date${saved.length === 1 ? "" : "s"} locked.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to lock dates.");
      try {
        const latest = await loadAdminLockedDates();
        setRecords(latest);
        setSelected((current) => current.filter((date) => !latest.some((item) => item.date.slice(0, 10) === date)));
      } catch { /* Keep the lock validation message. */ }
    } finally { setBusy(false); }
  }

  async function unlock() {
    if (!inspected || busy || !window.confirm(`Unlock ${dateLabel(inspected.date)}?`)) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await unlockDate(inspected.id);
      setRecords((current) => current.filter((item) => item.id !== inspected.id)); setInspectedDate(null);
      setSuccess(`${dateLabel(inspected.date)} unlocked.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to unlock date."); }
    finally { setBusy(false); }
  }

  return <main className="admin-page"><Card className="admin-card">
    <header className="admin-page-header"><div><h1>Lock Dates</h1><p>Block dates reserved manually outside the online quotation system.</p></div></header>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {success ? <div className="ok-summary" role="status">{success}</div> : null}
    {loading ? <p>Loading locked dates…</p> : <div className="admin-lock-layout">
      <section className="admin-lock-calendar" aria-label="Lock dates calendar">
        <div className="admin-lock-calendar-heading">
          <button type="button" className="hc-cal-nav" aria-label="Previous month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)))}>&lt;</button>
          <h2>{month.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
          <button type="button" className="hc-cal-nav" aria-label="Next month" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))}>&gt;</button>
        </div>
        <div className="hc-cal-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <div key={day}>{day}</div>)}</div>
        <div className="hc-cal-grid">{cells.map((date, index) => date ? <button key={date} type="button" disabled={busy}
          className={`hc-cal-cell admin-lock-day ${locks.has(date) ? "locked" : ""} ${selected.includes(date) ? "selected" : ""} ${inspectedDate === date ? "inspected" : ""}`}
          aria-label={`${dateLabel(date)}${locks.has(date) ? ", locked" : ""}`} aria-pressed={selected.includes(date) || inspectedDate === date} onClick={() => selectDate(date)}>
          <span>{Number(date.slice(-2))}</span>{locks.has(date) ? <small>LOCKED</small> : null}
        </button> : <div className="hc-cal-cell hc-cal-empty" key={`empty-${index}`} />)}</div>
      </section>
      <aside className="admin-lock-information">
        {inspected ? <>
          <h2>{dateLabel(inspected.date)}</h2><span className="admin-lock-badge">LOCKED</span>
          <dl><dt>Customer / Event Name</dt><dd>{inspected.customerName || "—"}</dd><dt>Reference</dt><dd>{inspected.reference || "—"}</dd><dt>Notes</dt><dd>{inspected.note || "—"}</dd><dt>Created At</dt><dd>{new Date(inspected.createdAt).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" })} MYT</dd></dl>
          <Button type="button" variant="secondary" disabled={busy} onClick={unlock}>Unlock Date</Button>
        </> : <>
          <h2>Selected dates ({selected.length})</h2>
          {selected.length ? <ul className="admin-lock-selected">{selected.map((date) => <li key={date}>{dateLabel(date)}</li>)}</ul> : <p>Select one or more dates from the calendar.</p>}
          <label className="admin-field"><span>Customer / Event Name (optional)</span><input value={draft.customerName} disabled={busy} onChange={(event) => setDraft({ ...draft, customerName: event.target.value })} /></label>
          <label className="admin-field"><span>Reference (optional)</span><input value={draft.reference} disabled={busy} onChange={(event) => setDraft({ ...draft, reference: event.target.value })} /></label>
          <label className="admin-field"><span>Notes (optional)</span><textarea rows={4} value={draft.note} disabled={busy} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
          <Button type="button" disabled={busy || !selected.length} onClick={save}>{busy ? "Locking…" : "Lock Selected Dates"}</Button>
        </>}
      </aside>
    </div>}
  </Card></main>;
}
