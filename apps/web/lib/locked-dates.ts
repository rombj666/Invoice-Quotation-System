import { apiBaseUrl } from "./api-client";

export type LockedDate = {
  id: string;
  date: string;
  customerName: string | null;
  reference: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init?.headers } });
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? "Unable to update locked dates.");
  return body as T;
}

export function loadLockedDates() { return request<string[]>("/api/locked-dates"); }
export function loadAdminLockedDates() { return request<LockedDate[]>("/api/admin/lock-dates"); }
export function lockDates(data: { dates: string[]; customerName: string; reference: string; note: string }) {
  return request<LockedDate[]>("/api/admin/lock-dates", { method: "POST", body: JSON.stringify(data) });
}
export function unlockDate(id: string) { return request<void>(`/api/admin/lock-dates/${encodeURIComponent(id)}`, { method: "DELETE" }); }
