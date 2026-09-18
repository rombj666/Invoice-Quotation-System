export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: any[]) => void;
  }
}

export function trackGaEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!GA_MEASUREMENT_ID) return;
  if (typeof window.gtag !== "function") return;

  window.gtag("event", eventName, params ?? {});
}