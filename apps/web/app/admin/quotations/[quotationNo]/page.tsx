"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "../../../../components/common/Card";
import { calculatePricing } from "../../../../lib/pricing";
import { approveQuotation, deleteQuotation, loadQuotationByNo } from "../../../../lib/quotation-storage";
import { formatDateLabel, formatMoney, formatTime } from "../../../../lib/formatters";
import type { QuotationData } from "../../../../types/quotation";

export default function AdminQuotationDetailPage() {
  const params = useParams<{ quotationNo: string }>();
  const router = useRouter();
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadQuotationByNo(params.quotationNo).then(setQuotation).catch(() => setError("Unable to load quotation."));
  }, [params.quotationNo]);

  if (!quotation) {
    return (
      <main className="hc-page admin-page">
        <Card>
          <h1>Quotation not found</h1>
          <Link className="hc-button hc-button-secondary" href="/admin/quotations">
            Back to Quotation List
          </Link>
        </Card>
      </main>
    );
  }

  const pricing = calculatePricing(quotation);
  const currentQuotation = quotation;
  const status = currentQuotation.status ?? "PENDING_APPROVAL";
  const isApproved = status === "APPROVED";

  async function approve() {
    if (!window.confirm("Are you sure you want to approve this quotation?")) return;
    setError("");
    setSuccess("");
    try {
      setQuotation(await approveQuotation(currentQuotation.quotationNo));
      setSuccess("Quotation approved successfully.");
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Unable to approve quotation.");
    }
  }

  async function remove() {
    setError("");
    try {
      await deleteQuotation(currentQuotation.quotationNo);
      router.push("/admin/quotations");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete quotation.");
    }
  }

  return (
    <main className="hc-page admin-page">
      <Card className="admin-card">
        <div className="admin-nav">
          <Link href="/admin">Admin Home</Link>
          <Link href="/admin/quotations">Quotation List</Link>
          <Link href="/admin/invoices">Invoice List</Link>
        </div>
        <div className="admin-detail-header">
          <div>
            <h1>{quotation.quotationNo}</h1>
            <span className={`admin-status-badge large ${isApproved ? "approved" : "pending"}`}>{isApproved ? "APPROVED" : "PENDING APPROVAL"}</span>
          </div>
          {!isApproved ? (
            <button className="admin-approve-button large" type="button" onClick={approve}>
              Approve Quotation
            </button>
          ) : null}
        </div>
        {error ? <p className="error">{error}</p> : null}
        {success ? <div className="ok-summary">{success}</div> : null}
        {isApproved ? <div className="ok-summary">This quotation has been approved. Customer can now continue to invoice.</div> : null}
        <div className="detail-grid">
          <section>
            <h3>Customer Info</h3>
            <p>{quotation.customer.name}</p>
            <p>{quotation.customer.phone}</p>
            <p>{quotation.customer.email}</p>
            <p>{quotation.customer.companyName || "-"}</p>
            <p>{quotation.customer.billingAddress}</p>
          </section>
          <section>
            <h3>Event</h3>
            <p>Location: {quotation.location}</p>
            <p>Event type: {quotation.eventType === "Others" ? quotation.customEventType : quotation.eventType}</p>
            <p>Status: {isApproved ? "APPROVED" : "PENDING APPROVAL"}</p>
          </section>
          <section>
            <h3>Service Dates</h3>
            {quotation.serviceDates.map((date) => (
              <p key={date.id}>
                {formatDateLabel(date.serviceDate)} - {date.cups} cups - {formatTime(date.startTime)} to {formatTime(date.endTime)}
              </p>
            ))}
          </section>
          <section>
            <h3>Drink Distribution</h3>
            {quotation.serviceDates.map((date) => (
              <div key={date.id}>
                <strong>{formatDateLabel(date.serviceDate)}</strong>
                {Object.entries(quotation.drinkOrders[date.id] ?? {}).map(([drink, qty]) => (
                  <p key={drink}>
                    {drink}: ice {qty.ice}, hot {qty.hot}
                  </p>
                ))}
              </div>
            ))}
          </section>
          <section>
            <h3>Add-ons</h3>
            {quotation.selectedAddons.map((addon) => (
              <p key={addon.name}>
                {addon.name}: {formatMoney(addon.price)}
              </p>
            ))}
            {quotation.hasCupStickers ? <p>Custom Cup Stickers</p> : null}
            {quotation.hasCupSleeves ? <p>Custom Cup Sleeves</p> : null}
          </section>
          <section>
            <h3>Customization Options</h3>
            <p>Cart: {quotation.customizationOptions?.cart.mode ?? "same"} / {quotation.customizationOptions?.cart.designCount ?? 1} design(s)</p>
            <p>Sticker: {quotation.customizationOptions?.sticker.mode ?? "same"} / {quotation.customizationOptions?.sticker.designCount ?? 1} design(s)</p>
            <p>Sleeve: {quotation.customizationOptions?.sleeve.mode ?? "same"} / {quotation.customizationOptions?.sleeve.designCount ?? 1} design(s)</p>
          </section>
          <section>
            <h3>Pricing</h3>
            <p>Subtotal: {formatMoney(pricing.subtotal)}</p>
            <p>Discount: {formatMoney(pricing.discountAmount)}</p>
            <p>Total: {formatMoney(pricing.total)}</p>
          </section>
        </div>
        <div className="admin-bottom-actions">
          {!isApproved ? <button className="admin-approve-button" type="button" onClick={approve}>Approve Quotation</button> : null}
          <button type="button" onClick={remove}>Delete Quotation</button>
          <Link href="/admin/quotations">Back to Quotation List</Link>
        </div>
      </Card>
    </main>
  );
}
