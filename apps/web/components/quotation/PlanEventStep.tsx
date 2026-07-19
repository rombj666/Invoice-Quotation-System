"use client";

import type { PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { ServiceDate } from "../../types/quotation";
import type { PricingBreakdown } from "../../lib/pricing";
import { getMinimumSelectableDate, toLocalIsoDate } from "../../lib/calendar";
import { formatDateLabel, formatMoney, formatTime } from "../../lib/formatters";
import { getBaristasNeeded } from "../../lib/pricing";
import { Button } from "../common/Button";
import { StepNavigation } from "../common/StepNavigation";

type Props = {
  serviceDates: ServiceDate[];
  setServiceDates: (dates: ServiceDate[]) => void;
  onNext: () => void;
  error: string;
  pricing: Pick<PricingBreakdown, "baseAmount" | "setupFee" | "extraBaristaFee">;
};

export function PlanEventStep({ serviceDates, setServiceDates, onNext, error, pricing }: Props) {
  const serviceDatesRef = useRef(serviceDates);
  const pointerSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startIso: string;
    mode: "select" | "remove";
    dragging: boolean;
    handled: Set<string>;
    captureTarget: HTMLButtonElement;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ mode: "select" | "remove"; dates: Set<string> } | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });

  const [{ todayIso, minimumSelectableIso }] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      todayIso: toLocalIsoDate(today),
      minimumSelectableIso: toLocalIsoDate(getMinimumSelectableDate(today))
    };
  });

  useEffect(() => {
    serviceDatesRef.current = serviceDates;
  }, [serviceDates]);

  useEffect(() => {
    const validServiceDates = serviceDates.filter((date) => date.serviceDate >= minimumSelectableIso);
    if (validServiceDates.length === serviceDates.length) return;
    serviceDatesRef.current = validServiceDates;
    setServiceDates(validServiceDates);
  }, [minimumSelectableIso, serviceDates, setServiceDates]);

  const timeOptions = Array.from({ length: 30 }).map((_, index) => {
    const totalMinutes = 8 * 60 + index * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  });

  function addDate(value: string) {
    const current = serviceDatesRef.current;
    if (!value || current.some((date) => date.serviceDate === value)) return;
    const next = [
      ...current,
      {
        id: crypto.randomUUID(),
        serviceDate: value,
        cups: 50,
        startTime: "",
        endTime: ""
      }
    ].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
    serviceDatesRef.current = next;
    setServiceDates(next);
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

  function moveMonth(amount: number) {
    const next = new Date(calendarMonth);
    next.setMonth(next.getMonth() + amount);
    setCalendarMonth(next);
  }

  const selectedDateValues = serviceDates.map((date) => date.serviceDate);
  const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarCells = [
    ...Array.from({ length: firstDay.getDay() }).map(() => ""),
    ...Array.from({ length: daysInMonth }).map((_, index) => toLocalIsoDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1)))
  ];
  function updateDate(id: string, patch: Partial<ServiceDate>) {
    setServiceDates(serviceDates.map((date) => (date.id === id ? { ...date, ...patch } : date)));
  }

  function removeDate(id: string) {
    const next = serviceDatesRef.current.filter((date) => date.id !== id);
    serviceDatesRef.current = next;
    setServiceDates(next);
  }

  function startDrag(iso: string, event: PointerEvent<HTMLButtonElement>) {
    if (iso < minimumSelectableIso || (event.pointerType === "mouse" && event.button !== 0)) return;
    const mode = serviceDatesRef.current.some((date) => date.serviceDate === iso) ? "remove" : "select";
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startIso: iso,
      mode,
      dragging: false,
      handled: new Set(),
      captureTarget: event.currentTarget
    };
  }

  function applyDragDate(iso: string, mode: "select" | "remove") {
    if (iso < minimumSelectableIso) return;
    const current = serviceDatesRef.current;
    const next = mode === "select"
      ? addDateWithList(iso, current)
      : current.filter((date) => date.serviceDate !== iso);
    if (next === current || (next.length === current.length && next.every((date, index) => date === current[index]))) return;
    serviceDatesRef.current = next;
    setServiceDates(next);
  }

  function dateUnderPointer(clientX: number, clientY: number): string | null {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-calendar-date]");
    const iso = element?.dataset.calendarDate ?? null;
    return iso && iso >= minimumSelectableIso ? iso : null;
  }

  function handleCrossedDate(iso: string, session: NonNullable<typeof pointerSessionRef.current>) {
    if (session.handled.has(iso) || iso < minimumSelectableIso) return;
    session.handled.add(iso);
    applyDragDate(iso, session.mode);
    setDragPreview({ mode: session.mode, dates: new Set(session.handled) });
  }

  function trackPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const session = pointerSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (!session.dragging) {
      const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
      if (distance < 6) return;
      session.dragging = true;
      handleCrossedDate(session.startIso, session);
    }
    event.preventDefault();
    const iso = dateUnderPointer(event.clientX, event.clientY);
    if (iso) handleCrossedDate(iso, session);
  }

  function finishPointer(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const session = pointerSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (!cancelled && session.dragging) {
      const iso = dateUnderPointer(event.clientX, event.clientY);
      if (iso) handleCrossedDate(iso, session);
    } else if (!cancelled) {
      toggleDate(session.startIso);
    }
    if (session.captureTarget.hasPointerCapture(session.pointerId)) {
      session.captureTarget.releasePointerCapture(session.pointerId);
    }
    pointerSessionRef.current = null;
    setDragPreview(null);
  }

  function toggleDate(value: string) {
    if (value < minimumSelectableIso) return;
    const existing = serviceDatesRef.current.find((date) => date.serviceDate === value);
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
            const isFullyBooked = iso >= todayIso && iso < minimumSelectableIso;
            const isUnavailable = isPast || isFullyBooked;
            const isSelected = selectedDateValues.includes(iso);
            const isPreview = !isUnavailable && Boolean(dragPreview?.dates.has(iso));
            return (
              <button
                className={`hc-cal-cell ${isUnavailable ? "hc-cal-unavailable" : ""} ${isSelected ? "hc-cal-selected" : ""} ${isPreview ? `hc-cal-preview hc-cal-preview-${dragPreview?.mode}` : ""}`}
                type="button"
                key={iso}
                data-calendar-date={iso}
                disabled={isUnavailable}
                aria-disabled={isUnavailable}
                aria-label={isPast ? `${Number(iso.slice(-2))}, unavailable` : isFullyBooked ? `${Number(iso.slice(-2))}, fully booked` : String(Number(iso.slice(-2)))}
                tabIndex={isUnavailable ? -1 : 0}
                onPointerDown={(event) => startDrag(iso, event)}
                onPointerMove={trackPointerMove}
                onPointerUp={(event) => finishPointer(event)}
                onPointerCancel={(event) => finishPointer(event, true)}
              >
                {isPast ? (
                  <span className="hc-cal-day" aria-hidden="true">/</span>
                ) : (
                  <>
                    <span className="hc-cal-day">{Number(iso.slice(-2))}</span>
                    {isFullyBooked ? <span className="hc-cal-booked-stamp">FULLY<br />BOOKED</span> : null}
                  </>
                )}
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
          Extra barista fee: {formatMoney(pricing.extraBaristaFee)}
          <br />
          Estimated total before add-ons: {formatMoney(pricing.baseAmount + pricing.setupFee + pricing.extraBaristaFee)}
        </div>
      ) : null}
      {serviceDates.length && hasInvalidTime ? <div className="warn-summary">Fix invalid service time before the order summary can be calculated.</div> : null}
      {copyMessage ? <div className="ok-summary">{copyMessage}</div> : null}

      {error ? <p className="error">{error}</p> : null}
      <StepNavigation canGoBack={false} onNext={onNext} />
    </div>
  );
}
