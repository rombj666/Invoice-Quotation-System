"use client";

import type { PointerEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { formatDateLabel } from "../../lib/formatters";
import { toLocalIsoDate } from "../../lib/calendar";
import type { ServiceDate } from "../../types/quotation";

type Props = {
  serviceDates: ServiceDate[];
  minimumDate: string;
  onChange: (dates: ServiceDate[]) => void;
  sideContent?: ReactNode;
};

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  startIso: string;
  mode: "select" | "remove";
  dragging: boolean;
  handled: Set<string>;
  captureTarget: HTMLButtonElement;
};

function newServiceDate(value: string): ServiceDate {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `service-date-${Date.now()}-${value}`;
  return { id, serviceDate: value, cups: 0, startTime: "", endTime: "" };
}

export function QuotationDatePicker({ serviceDates, minimumDate, onChange, sideContent }: Props) {
  const datesRef = useRef(serviceDates);
  const calendarRef = useRef<HTMLDivElement>(null);
  const pointerSessionRef = useRef<DragSession | null>(null);
  const [dragPreview, setDragPreview] = useState<{ mode: "select" | "remove"; dates: Set<string> } | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date(`${serviceDates[0]?.serviceDate || minimumDate}T12:00:00`);
    date.setDate(1);
    return date;
  });

  useEffect(() => {
    datesRef.current = serviceDates;
  }, [serviceDates]);

  const selectedValues = new Set(serviceDates.map((date) => date.serviceDate));
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const leadingCells = firstDay.getDay();
  const visibleCellCount = Math.ceil((leadingCells + daysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: visibleCellCount }, (_, index) => {
    const day = index - leadingCells + 1;
    return day > 0 && day <= daysInMonth
      ? toLocalIsoDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day))
      : "";
  });
  const minimumMonth = minimumDate.slice(0, 7);
  const currentMonth = toLocalIsoDate(calendarMonth).slice(0, 7);

  function commit(next: ServiceDate[]) {
    const sorted = [...next].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
    datesRef.current = sorted;
    onChange(sorted);
  }

  function addDate(value: string, dates = datesRef.current) {
    if (!value || value < minimumDate || dates.some((date) => date.serviceDate === value)) return dates;
    return [...dates, newServiceDate(value)];
  }

  function toggleDate(value: string) {
    if (value < minimumDate) return;
    const existing = datesRef.current.find((date) => date.serviceDate === value);
    commit(existing
      ? datesRef.current.filter((date) => date.id !== existing.id)
      : addDate(value));
  }

  function removeDate(id: string) {
    commit(datesRef.current.filter((date) => date.id !== id));
  }

  function applyDragDate(value: string, mode: "select" | "remove") {
    if (value < minimumDate) return;
    const current = datesRef.current;
    const next = mode === "select"
      ? addDate(value, current)
      : current.filter((date) => date.serviceDate !== value);
    if (next.length !== current.length) commit(next);
  }

  function startDrag(value: string, event: PointerEvent<HTMLButtonElement>) {
    if (value < minimumDate || (event.pointerType === "mouse" && event.button !== 0)) return;
    const mode = datesRef.current.some((date) => date.serviceDate === value) ? "remove" : "select";
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startIso: value,
      mode,
      dragging: false,
      handled: new Set(),
      captureTarget: event.currentTarget
    };
  }

  function dateUnderPointer(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-calendar-date]");
    const value = element?.dataset.calendarDate ?? "";
    return value >= minimumDate ? value : null;
  }

  function handleCrossedDate(value: string, session: DragSession) {
    if (session.handled.has(value) || value < minimumDate) return;
    session.handled.add(value);
    applyDragDate(value, session.mode);
    setDragPreview({ mode: session.mode, dates: new Set(session.handled) });
  }

  function trackPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const session = pointerSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (!session.dragging) {
      if (Math.hypot(event.clientX - session.startX, event.clientY - session.startY) < 6) return;
      session.dragging = true;
      handleCrossedDate(session.startIso, session);
    }
    event.preventDefault();
    const value = dateUnderPointer(event.clientX, event.clientY);
    if (value) handleCrossedDate(value, session);
  }

  function finishPointer(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const session = pointerSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (!cancelled && session.dragging) {
      const value = dateUnderPointer(event.clientX, event.clientY);
      if (value) handleCrossedDate(value, session);
    } else if (!cancelled) {
      toggleDate(session.startIso);
    }
    if (session.captureTarget.hasPointerCapture(session.pointerId)) {
      session.captureTarget.releasePointerCapture(session.pointerId);
    }
    pointerSessionRef.current = null;
    setDragPreview(null);
  }

  function moveMonth(amount: number) {
    setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  return <section className="quotation-date-panel quotation-inline-date-picker">
    <div className="quotation-section-heading">
      <div><span>Schedule</span><h2>Event Dates</h2></div>
      <strong>{serviceDates.length} selected</strong>
    </div>
    <div className="quotation-inline-calendar-layout">
      <div className="hc-calendar-wrap quotation-calendar" ref={calendarRef} tabIndex={-1}>
        <div className="hc-calendar-head">
          <button type="button" className="hc-cal-nav" onClick={() => moveMonth(-1)} disabled={currentMonth <= minimumMonth} aria-label="Previous month">&lt;</button>
          <div className="hc-cal-month">{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</div>
          <button type="button" className="hc-cal-nav" onClick={() => moveMonth(1)} aria-label="Next month">&gt;</button>
        </div>
        <div className="hc-cal-weekdays"><div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div></div>
        <div className="hc-cal-grid">
          {calendarCells.map((value, index) => {
            if (!value) return <div className="hc-cal-cell hc-cal-empty" key={`empty-${index}`} />;
            const unavailable = value < minimumDate;
            const selected = selectedValues.has(value);
            const previewed = !unavailable && Boolean(dragPreview?.dates.has(value));
            return <button
              className={`hc-cal-cell ${unavailable ? "hc-cal-unavailable" : ""} ${selected ? "hc-cal-selected" : ""} ${previewed ? `hc-cal-preview hc-cal-preview-${dragPreview?.mode}` : ""}`}
              type="button"
              key={value}
              data-calendar-date={value}
              disabled={unavailable}
              aria-pressed={selected}
              aria-label={`${Number(value.slice(-2))} ${calendarMonth.toLocaleDateString("en-US", { month: "long" })}${selected ? ", selected" : ""}`}
              onPointerDown={(event) => startDrag(value, event)}
              onPointerMove={trackPointerMove}
              onPointerUp={(event) => finishPointer(event)}
              onPointerCancel={(event) => finishPointer(event, true)}
            ><span className="hc-cal-day">{Number(value.slice(-2))}</span></button>;
          })}
        </div>
        <p className="hc-cal-help">Click to toggle · drag across dates to select several</p>
      </div>

      <aside className="quotation-selected-dates" aria-live="polite">
        <div><span>Selected dates</span><strong>{serviceDates.length || "—"}</strong></div>
        {sideContent}
        {serviceDates.length ? <div className="quotation-date-chips">{serviceDates.map((date) => <span className="quotation-date-chip" key={date.id}>
          <strong>{formatDateLabel(date.serviceDate)}</strong>
          <button type="button" aria-label={`Remove ${formatDateLabel(date.serviceDate)}`} onClick={() => removeDate(date.id)}>×</button>
        </span>)}</div> : <p className="selected-dates-empty">Choose one or more dates from the calendar.</p>}
        <button type="button" className="quotation-add-date" onClick={() => calendarRef.current?.focus()}>+ Add another date</button>
      </aside>
    </div>
  </section>;
}
