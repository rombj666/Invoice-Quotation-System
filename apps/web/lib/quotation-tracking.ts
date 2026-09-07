import { apiBaseUrl } from "./api-client";

const visitorStorageKey = "hourCoffeeQuotationVisitorV2";
const sessionStorageKey = "hourCoffeeQuotationDailySessionV2";
let lastActivityVisitDate = "";
let lastActivitySentAt = 0;

export function getQuotationTrackingSession() {
  let visitorId = window.localStorage.getItem(visitorStorageKey);
  if (!visitorId) {
    visitorId = window.crypto.randomUUID();
    window.localStorage.setItem(visitorStorageKey, visitorId);
  }
  const visitDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  let stored: { sessionId?: string; visitDate?: string } | null = null;
  try { stored = JSON.parse(window.localStorage.getItem(sessionStorageKey) ?? "null"); } catch { /* Replace an invalid daily session. */ }
  if (stored?.visitDate !== visitDate || !stored.sessionId) {
    stored = { sessionId: window.crypto.randomUUID(), visitDate };
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(stored));
  }
  return { visitorId, sessionId: stored.sessionId!, visitDate };
}

type QuotationTrackingEvent = "OPEN" | "ACTIVITY" | "STEP1_ENGAGED" | "STEP2_VISITED" | "PACKAGE_SELECTED";

export function trackQuotationEvent(event: QuotationTrackingEvent) {
  const session = getQuotationTrackingSession();
  const now = Date.now();
  if (event === "ACTIVITY" && lastActivityVisitDate === session.visitDate && now - lastActivitySentAt < 60_000) return;
  lastActivityVisitDate = session.visitDate;
  lastActivitySentAt = now;
  void fetch(`${apiBaseUrl}/api/quotation-tracking/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...session, event }),
    keepalive: true
  }).then(async (response) => {
    if (!response.ok) return;
    const tracked = await response.json() as { sessionId: string; visitDate: string };
    // Concurrent tabs converge on the backend's visitor/date session.
    const current = getQuotationTrackingSession();
    if (current.visitorId === session.visitorId && current.visitDate === tracked.visitDate) {
      window.localStorage.setItem(sessionStorageKey, JSON.stringify({ sessionId: tracked.sessionId, visitDate: tracked.visitDate }));
    }
  }).catch(() => undefined);
}
