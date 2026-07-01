"use client";

import type { PointerEvent } from "react";
import { useRef, useState } from "react";
import type { ServiceDate } from "../../types/quotation";
import { formatDateLabel, formatMoney, formatTime } from "../../lib/formatters";
import { getBaristasNeeded, getExtraBaristaFee, getSetupFee } from "../../lib/pricing";
import { Button } from "../common/Button";
import { StepNavigation } from "../common/StepNavigation";

type Props = {
  serviceDates: ServiceDate[];
  setServiceDates: (dates: ServiceDate[]) => void;
  onNext: () => void;
  error: string;
};

export function PlanEventStep({ serviceDates, setServiceDates, onNext, error }: Props) {
  const [dragStartIso, setDragStartIso] = useState<string | null>(null);
  const [dragEndIso, setDragEndIso] = useState<string | null>(null);
  const [dragMode, setDragMode] = useState<"select" | "remove">("select");
  const [hasDragged, setHasDragged] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });

  const timeOptions = Array.from({ length: 30 }).map((_, index) => {
    const totalMinutes = 8 * 60 + index * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  });

  function addDate(value: string) {
    if (!value || serviceDates.some((date) => date.serviceDate === value)) return;
    setServiceDates([
      ...serviceDates,
      {
        id: crypto.randomUUID(),
        serviceDate: value,
        cups: 50,
        startTime: "",
        endTime: ""
      }
    ].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)));
  }

  function addDateWithList(value: string, dates: ServiceDate[]): ServiceDate[] {
    if (!value || dates.some((date) => date.serviceDate === value)) return dates;
    return [
      ...dates,
      {
        id: crypto.randomUUID(),
        serviceDate: value,
        cups: 50,
        startTime: "",
        endTime: ""
      }
    ].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
  }

  function isInvalidTime(date: ServiceDate): boolean {
    return Boolean(date.startTime && date.endTime && date.endTime <= date.startTime);
  }

  function dateToIso(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function moveMonth(amount: number) {
    const next = new Date(calendarMonth);
    next.setMonth(next.getMonth() + amount);
    setCalendarMonth(next);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const selectedDateValues = serviceDates.map((date) => date.serviceDate);
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstDay.getDay() }).map(() => ""),
    ...Array.from({ length: daysInMonth }).map((_, index) => dateToIso(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1)))
  ];
  const previewDates = new Set<string>();
  if (dragStartIso && dragEndIso) {
    const start = new Date(`${dragStartIso}T12:00:00`);
    const end = new Date(`${dragEndIso}T12:00:00`);
    const from = start <= end ? start : end;
    const to = start <= end ? end : start;
    for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      previewDates.add(dateToIso(cursor));
    }
  }

  function updateDate(id: string, patch: Partial<ServiceDate>) {
    setServiceDates(serviceDates.map((date) => (date.id === id ? { ...date, ...patch } : date)));
  }

  function removeDate(id: string) {
    setServiceDates(serviceDates.filter((date) => date.id !== id));
  }

  function applyDateRange(startIso: string, endIso: string, mode: "select" | "remove") {
    const start = new Date(`${startIso}T12:00:00`);
    const end = new Date(`${endIso}T12:00:00`);
    const from = start <= end ? start : end;
    const to = start <= end ? end : start;
    let next = [...serviceDates];
    for (let cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
      const iso = dateToIso(cursor);
      if (iso < todayIso) continue;
      if (mode === "select") next = addDateWithList(iso, next);
      else next = next.filter((date) => date.serviceDate !== iso);
    }
    setServiceDates(next.sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)));
  }

  function startDrag(iso: string, event: PointerEvent<HTMLButtonElement>) {
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    setDragStartIso(iso);
    setDragEndIso(iso);
    setDragMode(selectedDateValues.includes(iso) ? "remove" : "select");
    setHasDragged(false);
  }

  function trackPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!pointerStartRef.current || hasDragged) return;
    const distance = Math.hypot(event.clientX - pointerStartRef.current.x, event.clientY - pointerStartRef.current.y);
    if (distance > 6) setHasDragged(true);
  }

  function clearDrag() {
    pointerStartRef.current = null;
    setDragStartIso(null);
    setDragEndIso(null);
    setHasDragged(false);
  }

  function endDrag(iso: string) {
    if (!dragStartIso) {
      toggleDate(iso);
      return;
    }
    if (hasDragged) applyDateRange(dragStartIso, dragEndIso ?? iso, dragMode);
    else toggleDate(dragStartIso);
    clearDrag();
  }

  function toggleDate(value: string) {
    const existing = serviceDates.find((date) => date.serviceDate === value);
    if (existing) removeDate(existing.id);
    else addDate(value);
  }

  function copyToAll(source: ServiceDate) {
    setServiceDates(serviceDates.map((date) => ({ ...date, cups: source.cups, startTime: source.startTime, endTime: source.endTime })));
    setCopyMessage("Cups and service time copied to all selected dates.");
  }

  const totalCups = serviceDates.reduce((sum, date) => sum + date.cups, 0);
  const hasInvalidTime = serviceDates.some(isInvalidTime);

  return (
    <div>
      <h2>Plan the event</h2>
      <p className="step-copy">Set different cups and hours for each day.</p>

      <div className="hc-calendar-wrap">
        <div className="hc-calendar-head">
          <button type="button" className="hc-cal-nav" onClick={() => moveMonth(-1)} aria-label="Previous month">
            &lt;
          </button>
          <div className="hc-cal-month">{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
          <button type="button" className="hc-cal-nav" onClick={() => moveMonth(1)} aria-label="Next month">
            &gt;
          </button>
        </div>
        <div className="hc-cal-weekdays">
          <div>Su</div>
          <div>Mo</div>
          <div>Tu</div>
          <div>We</div>
          <div>Th</div>
          <div>Fr</div>
          <div>Sa</div>
        </div>
        <div className="hc-cal-grid">
          {calendarCells.map((iso, index) => {
            if (!iso) return <div className="hc-cal-cell hc-cal-empty" key={`empty-${index}`} />;
            const isPast = iso < todayIso;
            const isSelected = selectedDateValues.includes(iso);
            const isPreview = previewDates.has(iso);
            return (
              <button
                className={`hc-cal-cell ${isPast ? "hc-cal-past" : ""} ${isSelected ? "hc-cal-selected" : ""} ${isPreview ? `hc-cal-preview hc-cal-preview-${dragMode}` : ""}`}
                type="button"
                key={iso}
                disabled={isPast}
                onPointerDown={(event) => {
                  startDrag(iso, event);
                }}
                onPointerMove={trackPointerMove}
                onPointerEnter={() => {
                  if (dragStartIso) {
                    setDragEndIso(iso);
                    if (iso !== dragStartIso) setHasDragged(true);
                  }
                }}
                onPointerUp={() => endDrag(iso)}
                onPointerCancel={clearDrag}
              >
                {Number(iso.slice(-2))}
              </button>
            );
          })}
        </div>
      </div>
      <p className="hc-cal-help">Tap a date to toggle - drag across dates to select a range</p>

      <div className="date-list">
        {serviceDates.map((date) => (
          <div className="date-row" key={date.id}>
            <div className="date-row-head">
              <strong>{formatDateLabel(date.serviceDate)}</strong>
              <button type="button" onClick={() => removeDate(date.id)}>
                REMOVE
              </button>
            </div>
            <div className="date-grid">
              <label>
                Cups
                <input
                  type="number"
                  min={50}
                  value={date.cups}
                  onChange={(event) => updateDate(date.id, { cups: Number(event.target.value) })}
                />
              </label>
              <label>
                Start time
                <select value={date.startTime} onChange={(event) => updateDate(date.id, { startTime: event.target.value })}>
                  <option value="">Select</option>
                  {timeOptions.map((time) => (
                    <option value={time} key={time}>
                      {formatTime(time)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                End time
                <select value={date.endTime} onChange={(event) => updateDate(date.id, { endTime: event.target.value })}>
                  <option value="">Select</option>
                  {timeOptions.map((time) => (
                    <option value={time} key={time}>
                      {formatTime(time)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mini-summary">
              {isInvalidTime(date) ? (
                <span className="invalid-time-text">End time must be after start time.</span>
              ) : (
                <>
                  {date.startTime && date.endTime ? `${formatTime(date.startTime)} to ${formatTime(date.endTime)}` : "Set service time"}
                  {" | "}
                  {getBaristasNeeded(date)} barista(s)
                  {" | "}
                  Extra barista fee {formatMoney(getExtraBaristaFee(date))}
                </>
              )}
            </div>
            {serviceDates.length > 1 ? (
              <Button type="button" variant="secondary" onClick={() => copyToAll(date)}>
                Copy cups and time to all dates
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      {serviceDates.length && !hasInvalidTime ? (
        <div className="dark-summary">
          Total cups: {totalCups}
          <br />
          Service dates: {serviceDates.length}
          <br />
          Estimated total before add-ons: {formatMoney(Math.max(totalCups * 10, 550) + getSetupFee(serviceDates) + serviceDates.reduce((sum, date) => sum + getExtraBaristaFee(date), 0))}
        </div>
      ) : null}
      {serviceDates.length && hasInvalidTime ? <div className="warn-summary">Fix invalid service time before the order summary can be calculated.</div> : null}
      {copyMessage ? <div className="ok-summary">{copyMessage}</div> : null}

      {error ? <p className="error">{error}</p> : null}
      <StepNavigation canGoBack={false} onNext={onNext} />
    </div>
  );
}
