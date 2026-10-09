"use client";

import { extraChargeDateLabel } from "../../../../lib/extra-charge-dates";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminSectionEditor } from "../../../../components/admin/AdminSectionEditor";
import { Card } from "../../../../components/common/Card";
import { normalizeMalaysiaWhatsAppNumber, openAdminCustomerWhatsApp } from "../../../../lib/contact";
import { calculateQuotationPricing, getDurationLabel } from "../../../../lib/pricing";
import { CART_SELECTION_ERROR, hasCartAddonConflict } from "../../../../lib/addons";
import { deleteQuotation, loadQuotationByNo } from "../../../../lib/quotation-storage";
import { formatDateLabel, formatMoney, formatTime } from "../../../../lib/formatters";
import type { QuotationData } from "../../../../types/quotation";
import { getAdminAddonRows } from "../../../../lib/admin-addons";
import { DocumentCard } from "../../../../components/admin/DocumentCard";



export default function AdminQuotationDetailPage() {
  const [activeSection, setActiveSection] = useState("summary");
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

  const pricing = calculateQuotationPricing(quotation);
  const hasQuotationDuration = Number.isFinite(quotation.totalCups) && (quotation.serviceDuration === "HALF_DAY" || quotation.serviceDuration === "FULL_DAY");
  const baristasProvided = pricing.minimumBaristas === pricing.requiredBaristas ? String(pricing.requiredBaristas) : `${pricing.minimumBaristas}–${pricing.requiredBaristas}`;
  const addonRows = getAdminAddonRows(quotation, pricing.cupStickerFee, pricing.cupSleeveFee);
  const currentQuotation = quotation;
  const status = currentQuotation.status ?? "PENDING_APPROVAL";
  const statusLabel = status === "PENDING_APPROVAL" ? "Pending Approval" : status === "GENERATED_INVOICE" ? "Generated Invoice" : "Completed";
  const statusClass = status === "PENDING_APPROVAL" ? "pending" : "approved";
  const canGenerateInvoice = !quotation.hasInvoice && status === "PENDING_APPROVAL";
  const canEditQuotation = !quotation.hasInvoice && status === "PENDING_APPROVAL";

  async function remove() {
    setError("");
    try {
      if (!window.confirm(`Permanently delete quotation ${currentQuotation.quotationNo}? This cannot be undone.`)) return;
      await deleteQuotation(currentQuotation.quotationNo);
      router.push("/admin/quotations");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete quotation.");
    }
  }

  return <main className="admin-page"><Card className="admin-card">
    <AdminSectionEditor title={quotation.quotationNo} backHref="/admin/quotations" activeSection={activeSection} onSectionChange={setActiveSection}
      actions={<><button type="button" aria-pressed={activeSection === "summary"} onClick={() => setActiveSection("summary")}>Summary</button>
{currentQuotation.invoiceNo ? <Link className="admin-approve-button large" href={`/admin/invoices/${currentQuotation.invoiceNo}`}>View Existing Invoice</Link> : canGenerateInvoice ? <Link className="admin-approve-button large" href={`/admin/quotations/${currentQuotation.quotationNo}/generate-invoice`}>Generate Invoice</Link> : null}
{canEditQuotation ? <><Link href={`/admin/quotations/${currentQuotation.quotationNo}/edit`}>Edit Quotation</Link><button type="button" onClick={remove}>Delete</button></> : null}

<button type="button" onClick={() => openAdminCustomerWhatsApp(currentQuotation)} disabled={!normalizeMalaysiaWhatsAppNumber(currentQuotation.customer.phone)}>
              {normalizeMalaysiaWhatsAppNumber(currentQuotation.customer.phone) ? "Contact Customer" : "No phone number"}
            </button></>}
      sections={[
        { id: "summary", label: "Summary", content: <><section><h2>Summary</h2><dl className="admin-summary-grid"><div><dt>Customer Name</dt><dd>{quotation.customer.name}</dd></div><div><dt>Phone</dt><dd>{quotation.customer.phone}</dd></div><div><dt>Email</dt><dd>{quotation.customer.email}</dd></div><div><dt>Total Cups</dt><dd>{pricing.totalCups}</dd></div><div><dt>Event Address</dt><dd>{quotation.fullAddress || quotation.location}</dd></div><div><dt>Event Date(s)</dt><dd>{quotation.serviceDates.map((date) => formatDateLabel(date.serviceDate)).join(", ")}</dd></div><div><dt>Selected Package</dt><dd>{quotation.packageSnapshot?.name || "-"}</dd></div><div><dt>Total Price</dt><dd>{formatMoney(pricing.total)}</dd></div></dl></section></> },
        { id: "customer", label: "Customer & Billing", content: <><section>
            <h3>Customer Info</h3>
            <p>{quotation.customer.name}</p>
            <p>{quotation.customer.phone}</p>
            <p>{quotation.customer.email}</p>
            <p>{quotation.customer.companyName || "-"}</p>
            <p>{quotation.customer.billingAddress}</p>
          </section></> },
        { id: "event", label: "Event", content: <><section>
            <h3>Event</h3>
            <p>Location: {quotation.location}</p>
            <p>Event type: {quotation.eventType === "Others" ? quotation.customEventType : quotation.eventType}</p>
            <p>Status: <span className={`admin-status-badge ${statusClass}`}>{statusLabel}</span></p>
          </section></> },
        { id: "dates", label: "Service Dates", content: <><section>
            <h3>Service Dates</h3>
            <p><strong>Total cups: {pricing.totalCups}</strong></p>
            <p><strong>Baristas per service date: {baristasProvided}</strong></p>
            {quotation.serviceDates.map((date) => (
              <p key={date.id}>
                {formatDateLabel(date.serviceDate)} — {hasQuotationDuration ? (quotation.serviceDuration === "FULL_DAY" ? "Full Day" : "Half Day") : date.durationMode ? getDurationLabel(date) : `${formatTime(date.startTime)} to ${formatTime(date.endTime)}`}
              </p>
            ))}
          </section></> },
        { id: "package", label: "Package", content: <>{quotation.packageSnapshot ? <section>
            <h3>Selected Package</h3>
            <p><strong>{quotation.packageSnapshot.name}</strong> · {formatMoney(quotation.packageSnapshot.price)}</p>
            {quotation.packageSnapshot.briefDescription ? <p>{quotation.packageSnapshot.briefDescription}</p> : null}
            {quotation.packageSnapshot.perks.map((perk) => <p key={perk.id}>✓ {perk.name}</p>)}
            {quotation.notes ? <p><strong>Customer notes:</strong> {quotation.notes}</p> : null}
          </section> : null}</> },
        { id: "addons", label: "Add-ons", content: <>{!quotation.packageSnapshot ? <section>
            <h3>Add-ons</h3>
            {addonRows.map((addon) => (
              <p key={addon.name}>
                {addon.name}: {addon.price > 0 ? formatMoney(addon.price) : "FREE"}
              </p>
            ))}
            {!addonRows.length ? <p>No add-ons selected.</p> : null}
            {hasCartAddonConflict(quotation.selectedAddons) ? <div className="warn-summary">{CART_SELECTION_ERROR}</div> : null}
          </section> : null}</> },
        { id: "charges", label: "Extra Charges", content: <>{(quotation.extraCharges ?? []).length ? <section>
            <h3>Manual Extra Charges</h3>
            <div className="admin-extra-charge-list">
              {(quotation.extraCharges ?? []).map((charge) => <div className="admin-extra-charge-row" key={charge.id}>
                <div><strong>{charge.title}</strong>{charge.description ? <p>{charge.description}</p> : null}<span>{formatMoney(charge.amount)}</span><p>Applies to: {extraChargeDateLabel(charge, quotation.serviceDates)}</p></div>
              </div>)}
            </div>
            <p><strong>Total extra charges: {formatMoney(pricing.manualExtraChargeTotal)}</strong></p>
          </section> : null}</> },
        { id: "documents", label: "Documents", content: <><DocumentCard documentLabel="Quotation PDF" fileUrl={quotation.quotationPdfUrl} fileName={`${quotation.quotationNo}.pdf`} /></> },
        { id: "history", label: "History", content: <>{quotation.editHistory?.length ? <section><h3>Edit History</h3>{quotation.editHistory.map((entry,index)=><p key={`${entry.changedAt}-${index}`}><strong>{new Date(entry.changedAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}</strong><br />{entry.summary || "Updated"} · {entry.changedBy}</p>)}</section> : null}</> },
      ]}
    >
        {error ? <p className="error" role="alert">{error}</p> : null}
        {success ? <div className="ok-summary">{success}</div> : null}
    </AdminSectionEditor>
  </Card></main>;
}
