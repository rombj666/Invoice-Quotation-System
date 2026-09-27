import { apiBaseUrl } from "./api-client";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  referenceNo?: string | null;
  link?: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationCenter = {
  notifications: AppNotification[];
  unreadCount: number;
};

export type NotificationIdentity =
  | { role: "admin" }
  | { role: "customer"; phone?: string; email?: string };

function notificationQuery(identity: NotificationIdentity): string {
  const params = new URLSearchParams({ role: identity.role });
  if (identity.role === "customer") {
    if (identity.phone) params.set("phone", identity.phone);
    if (identity.email) params.set("email", identity.email);
  }
  return params.toString();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? "Request failed");
  return payload as T;
}

export function loadNotifications(identity: NotificationIdentity): Promise<NotificationCenter> {
  return request<NotificationCenter>(`/api/notifications?${notificationQuery(identity)}`);
}

export function markNotificationRead(id: string): Promise<{ marked: number }> {
  return request<{ marked: number }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead(identity: NotificationIdentity): Promise<{ marked: number }> {
  return request<{ marked: number }>("/api/notifications/read-all", {
    method: "POST",
    body: JSON.stringify(identity)
  });
}
