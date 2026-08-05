import { apiBaseUrl } from "./api-client";

const sessionStorageKey = "hourCoffeeQuotationAnalyticsSession";

export function getQuotationAnalyticsSessionId(): string {
  const existing = window.localStorage.getItem(sessionStorageKey);
  if (existing) return existing;
  const sessionId = window.crypto.randomUUID();
  window.localStorage.setItem(sessionStorageKey, sessionId);
  return sessionId;
}

export function resetQuotationAnalyticsSession() {
  window.localStorage.removeItem(sessionStorageKey);
}

export function trackQuotationAnalytics(event: "OPEN" | "START" | "ACTIVITY", lastStep = 0) {
  const anonymousSessionId = getQuotationAnalyticsSessionId();
  void fetch(`${apiBaseUrl}/api/quotation-analytics/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anonymousSessionId, event, lastStep }),
    keepalive: true
  }).catch(() => undefined);
}
