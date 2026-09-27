"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card } from "../../components/common/Card";
import { loadCustomerOrders, type CustomerOrder, type CustomerOrdersResult } from "../../lib/customer-orders";
import { formatDateLabel, formatMoney } from "../../lib/formatters";

function todoLink(order: CustomerOrder, phone: string, email: string): { href: string; label: string } | null {
  for (const todo of order.todos) {
    if (todo.code === "QUOTATION_RETURNED") {
      return { href: `/customer/quotation/${encodeURIComponent(order.quotationNo)}/edit?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`, label: "Edit & resubmit" };
    }
    if (todo.code === "INVOICE_START") {
      return { href: `/customer/quotation/${encodeURIComponent(order.quotationNo)}/invoice?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`, label: "Submit invoice details" };
    }
    if (todo.code === "RECEIPT_UPLOAD" || todo.code === "RECEIPT_REJECTED") {
      return { href: `/invoice?quotationNo=${encodeURIComponent(order.quotationNo)}&invoiceNo=${encodeURIComponent(order.invoice?.invoiceNo ?? "")}`, label: "Upload payment receipt" };
    }
    if (todo.code === "RECEIPT_REVIEWING" || todo.code === "RECEIPT_UPLOADED" || todo.code === "RECEIPT_VERIFIED" || todo.code === "PAYMENT_CONFIRMED") {
      return { href: `/invoice?invoiceNo=${encodeURIComponent(order.invoice?.invoiceNo ?? "")}`, label: "View invoice" };
    }
  }
  return null;
}

function OrdersInner() {
  const searchParams = useSearchParams();
  const initialPhone = searchParams.get("phone") ?? "";
  const initialEmail = searchParams.get("email") ?? "";

  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [result, setResult] = useState<CustomerOrdersResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadOrders(identity: { phone: string; email: string }) {
    setLoading(true);
    setError("");
    try {
      setResult(await loadCustomerOrders(identity));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load your orders.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialPhone || initialEmail) void loadOrders({ phone: initialPhone, email: initialEmail });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="hc-page">
      <Card>
        <div className="orders-header">
          <div>
            <h1>My Orders</h1>
            <p>All your quotations, invoices and receipts in one place.</p>
          </div>
          <Link className="hc-button hc-button-secondary" href={`/notifications?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`}>
            Notification Center
          </Link>
        </div>

        {!result ? (
          <form
            className="orders-identity-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!phone.trim() && !email.trim()) {
                setError("Enter your phone number or email to view your orders.");
                return;
              }
              void loadOrders({ phone: phone.trim(), email: email.trim() });
            }}
          >
            <p>Sign in with the phone number or email you used when submitting your quotation.</p>
            <div className="hc-field">
              <label htmlFor="ordersPhone">Phone number</label>
              <input id="ordersPhone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 0123456789" />
            </div>
            <div className="hc-field">
              <label htmlFor="ordersEmail">Email</label>
              <input id="ordersEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="e.g. name@example.com" />
            </div>
            <button className="hc-button hc-button-primary" type="submit" disabled={loading}>
              {loading ? "Loading..." : "View my orders"}
            </button>
          </form>
        ) : null}

        {error ? <p className="error">{error}</p> : null}

        {result && !result.matched ? (
          <div className="orders-empty">
            <p>No orders found for the details you entered.</p>
            <button className="hc-button hc-button-secondary" type="button" onClick={() => setResult(null)}>Try again</button>
          </div>
        ) : null}

        {result && result.matched ? (
          <div className="orders-customer">Signed in as <strong>{result.customer?.name}</strong></div>
        ) : null}

        {result && result.matched ? (
          <ul className="orders-list">
            {result.orders.map((order) => {
              const action = todoLink(order, phone, email);
              const statusClass = order.status === "APPROVED" ? "approved" : order.status === "RETURNED_FOR_EDIT" ? "returned" : order.status === "CANCELLED" || order.status === "EXPIRED" ? "deleted" : "pending";
              const statusLabel = order.status === "RETURNED_FOR_EDIT" ? "RETURNED FOR EDIT" : order.status.replace(/_/g, " ");
              return (
                <li key={order.quotationNo} className="orders-item">
                  <div className="orders-item-head">
                    <span className={`admin-status-badge ${statusClass}`}>{statusLabel}</span>
                    <strong>{order.quotationNo}</strong>
                    <span className="orders-item-date">{formatDateLabel(order.createdAt.slice(0, 10))}</span>
                  </div>
                  <div className="orders-item-body">
                    <p>Total: <strong>{formatMoney(order.totalAmount)}</strong></p>
                    {order.firstEventDate ? <p>First service date: {formatDateLabel(order.firstEventDate)}</p> : null}
                    {order.expiresAt ? <p>Quotation expires: {formatDateLabel(order.expiresAt.slice(0, 10))}</p> : null}
                    {order.returnReason ? (
                      <p className="orders-return-reason"><strong>Admin note:</strong> {order.returnReason}</p>
                    ) : null}
                    {order.invoice ? (
                      <div className="orders-invoice">
                        <p>Invoice: <strong>{order.invoice.invoiceNo}</strong> · {order.invoice.paymentStatus.replace(/_/g, " ")} · {formatMoney(order.invoice.totalAmount)}</p>
                        {order.invoice.receipt ? (
                          <p>Receipt: {order.invoice.receipt.verificationStatus ?? order.invoice.receipt.status} · uploaded {formatDateLabel(order.invoice.receipt.uploadedAt.slice(0, 10))}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {order.todos.length ? (
                      <ul className="orders-todos">
                        {order.todos.map((todo) => <li key={todo.code}>{todo.message}</li>)}
                      </ul>
                    ) : null}
                  </div>
                  {action ? (
                    <div className="orders-item-action">
                      <Link className="hc-button hc-button-primary" href={action.href}>{action.label}</Link>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>
    </main>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<main className="hc-page">Loading my orders...</main>}>
      <OrdersInner />
    </Suspense>
  );
}
