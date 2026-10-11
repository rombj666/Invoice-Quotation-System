export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

export type GaEventDeliveryResult = "acknowledged" | "timeout" | "unavailable";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: any[]) => void;
  }
}

export function trackGaEvent(
  eventName: string,
  params?: Record<string, unknown>,
  onAcknowledged?: () => void
): boolean {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID || typeof window.gtag !== "function") return false;

  try {
    window.gtag("event", eventName, {
      ...params,
      ...(onAcknowledged ? { event_callback: onAcknowledged } : {})
    });
    return true;
  } catch {
    return false;
  }
}

export function trackGaEventWithCallback(
  eventName: string,
  params: Record<string, unknown> = {},
  timeoutMs = 1200,
  onAcknowledged?: () => void
): Promise<GaEventDeliveryResult> {
  return new Promise((resolve) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = (result: GaEventDeliveryResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };
    timeout = setTimeout(() => finish("timeout"), timeoutMs);
    const accepted = trackGaEvent(eventName, params, () => {
      try {
        onAcknowledged?.();
      } finally {
        finish("acknowledged");
      }
    });

    if (!accepted) finish("unavailable");
  });
}
