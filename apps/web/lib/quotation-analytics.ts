import { apiBaseUrl } from "./api-client";

const sessionStorageKey = "hourCoffeeQuotationAnalyticsSession";
const visitorStorageKey = "hourCoffeeAnonymousVisitor";
const milestoneEvents = ["START", "STEP2", "PACKAGE_SELECTED"] as const;
const pendingMilestones = new Set<string>();
const activityIntervalMs = 60_000;
let lastActivitySessionId = "";
let lastActivitySentAt = 0;
let activityTimer: number | undefined;
let pendingActivityStep = 0;

type QuotationAnalyticsEvent = "OPEN" | "ACTIVITY" | typeof milestoneEvents[number];

function clearPendingActivity() {
  if (activityTimer !== undefined) window.clearTimeout(activityTimer);
  activityTimer = undefined;
}

export function getQuotationAnalyticsSessionId(): string {
  const existing = window.localStorage.getItem(sessionStorageKey);
  if (existing) return existing;
  const sessionId = window.crypto.randomUUID();
  window.localStorage.setItem(sessionStorageKey, sessionId);
  return sessionId;
}

export function resetQuotationAnalyticsSession() {
  clearPendingActivity();
  window.localStorage.removeItem(sessionStorageKey);
  for (const event of milestoneEvents) window.localStorage.removeItem(`${sessionStorageKey}:${event}`);
  lastActivitySessionId = "";
  lastActivitySentAt = 0;
}

function getAnonymousVisitorId(): string {
  const existing = window.localStorage.getItem(visitorStorageKey);
  if (existing) return existing;
  const visitorId = window.crypto.randomUUID();
  window.localStorage.setItem(visitorStorageKey, visitorId);
  return visitorId;
}

export function trackQuotationAnalytics(event: QuotationAnalyticsEvent, lastStep = 0) {
  const anonymousSessionId = getQuotationAnalyticsSessionId();
  const milestoneKey = event === "OPEN" || event === "ACTIVITY" ? null : `${sessionStorageKey}:${event}`;
  const pendingKey = `${anonymousSessionId}:${event}`;
  if (milestoneKey && (window.localStorage.getItem(milestoneKey) === anonymousSessionId || pendingMilestones.has(pendingKey))) {
    trackQuotationAnalytics("ACTIVITY", lastStep);
    return;
  }

  const now = Date.now();
  if (event === "ACTIVITY" && lastActivitySessionId === anonymousSessionId && now - lastActivitySentAt < activityIntervalMs) {
    pendingActivityStep = lastStep;
    if (activityTimer === undefined) {
      activityTimer = window.setTimeout(() => {
        activityTimer = undefined;
        if (window.localStorage.getItem(sessionStorageKey) === anonymousSessionId) {
          trackQuotationAnalytics("ACTIVITY", pendingActivityStep);
        }
      }, activityIntervalMs - (now - lastActivitySentAt));
    }
    return;
  }
  clearPendingActivity();
  lastActivitySessionId = anonymousSessionId;
  lastActivitySentAt = now;
  if (milestoneKey) pendingMilestones.add(pendingKey);

  void fetch(`${apiBaseUrl}/api/quotation-analytics/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anonymousSessionId, anonymousVisitorId: getAnonymousVisitorId(), event, lastStep, pagePath: "/quotation" }),
    keepalive: true
  }).then((response) => {
    if (response.ok && milestoneKey && window.localStorage.getItem(sessionStorageKey) === anonymousSessionId) {
      window.localStorage.setItem(milestoneKey, anonymousSessionId);
    }
  }).catch(() => undefined).finally(() => pendingMilestones.delete(pendingKey));
}
