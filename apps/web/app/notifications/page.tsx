"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Card } from "../../components/common/Card";
import { loadNotifications, markAllNotificationsRead, markNotificationRead, type AppNotification } from "../../lib/notifications";

function NotificationCenterInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get("role") ?? "";
  const initialPhone = searchParams.get("phone") ?? "";
  const initialEmail = searchParams.get("email") ?? "";

  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = role === "admin";
  const needsIdentity = !isAdmin && !phone.trim() && !email.trim();

  const identity = useMemo(() => {
    if (isAdmin) return { role: "admin" as const };
    return { role: "customer" as const, phone: phone.trim(), email: email.trim() };
  }, [isAdmin, phone, email]);

  useEffect(() => {
    if (needsIdentity) return;
    setLoading(true);
    setError("");
    loadNotifications(identity)
      .then((center) => {
        setNotifications(center.notifications);
        setUnreadCount(center.unreadCount);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load notifications."))
      .finally(() => setLoading(false));
  }, [identity, needsIdentity]);

  async function handleMarkRead(id: string) {
    await markNotificationRead(id);
    setNotifications((current) => current?.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)) ?? null);
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead(identity);
    setNotifications((current) => current?.map((notification) => ({ ...notification, read: true })) ?? null);
    setUnreadCount(0);
  }

  function openNotification(notification: AppNotification) {
    if (!notification.read) void handleMarkRead(notification.id);
    if (notification.link) {
      router.push(notification.link);
    } else if (notification.referenceNo) {
      if (isAdmin && notification.type.startsWith("QUOTATION_")) router.push(`/admin/quotations/${encodeURIComponent(notification.referenceNo)}`);
      else if (isAdmin && notification.type.startsWith("INVOICE_")) router.push(`/admin/invoices/${encodeURIComponent(notification.referenceNo)}`);
      else router.push(`/orders?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`);
    }
  }

  return (
    <main className="hc-page">
      <Card>
        <div className="notification-header">
          <div>
            <h1>Notification Center</h1>
            {isAdmin ? <p>All admin notifications</p> : null}
            {!isAdmin && !needsIdentity ? <p>Notifications for {[phone, email].filter(Boolean).join(" / ")}</p> : null}
          </div>
          {notifications && notifications.length > 0 ? (
            <button className="hc-button hc-button-secondary" type="button" onClick={() => void handleMarkAllRead()}>
              Mark all as read
            </button>
          ) : null}
        </div>

        {needsIdentity ? (
          <form
            className="notification-identity-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!phone.trim() && !email.trim()) {
                setError("Enter your phone number or email to see notifications.");
                return;
              }
              setNotifications(null);
              setError("");
            }}
          >
            <p>Sign in with the phone number or email you used when submitting your quotation to see notifications about approvals, invoices and receipts.</p>
            <div className="hc-field">
              <label htmlFor="notificationPhone">Phone number</label>
              <input id="notificationPhone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 0123456789" />
            </div>
            <div className="hc-field">
              <label htmlFor="notificationEmail">Email</label>
              <input id="notificationEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="e.g. name@example.com" />
            </div>
            <button className="hc-button hc-button-primary" type="submit">Show my notifications</button>
          </form>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {loading ? <p>Loading notifications...</p> : null}

        {notifications && notifications.length === 0 ? (
          <div className="notification-empty">No notifications yet.</div>
        ) : null}

        {notifications && notifications.length > 0 ? (
          <ul className="notification-list">
            {notifications.map((notification) => (
              <li key={notification.id} className={`notification-item ${notification.read ? "" : "unread"}`}>
                <button className="notification-item-main" type="button" onClick={() => openNotification(notification)}>
                  <span className="notification-item-title">
                    {!notification.read ? <span className="notification-unread-dot" aria-label="unread" /> : null}
                    {notification.title}
                    {notification.referenceNo ? <span className="notification-reference">{notification.referenceNo}</span> : null}
                  </span>
                  <span className="notification-item-message">{notification.message}</span>
                  <span className="notification-item-time">{new Date(notification.createdAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}</span>
                </button>
                {!notification.read ? (
                  <button className="notification-item-read" type="button" onClick={() => void handleMarkRead(notification.id)}>
                    Mark read
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {!isAdmin && !needsIdentity ? (
          <p className="notification-footer">
            <Link href={`/orders?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`}>View all my orders</Link>
          </p>
        ) : null}
      </Card>
    </main>
  );
}

export default function NotificationCenterPage() {
  return (
    <Suspense fallback={<main className="hc-page">Loading notification center...</main>}>
      <NotificationCenterInner />
    </Suspense>
  );
}
