"use client";

import { extraChargeDateLabel } from "../../lib/extra-charge-dates";
import pdfStyles from "./QuotationPdf.module.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { QuotationData, ServiceDate } from "../../types/quotation";
import { CART_SELECTION_ERROR, hasCartAddonConflict } from "../../lib/addons";
import { calculateQuotationPricing, getDurationLabel } from "../../lib/pricing";
import { submitQuotationWithPdf } from "../../lib/quotation-storage";
import { formatCompactDate, formatMoney, formatTime } from "../../lib/formatters";
import { downloadPdfBlob, generatePdfBlob } from "../../lib/pdf-document";
import { getAllProvidedBeverageNames, getProvidedBeverageNames } from "../../lib/beverages";
import { Button } from "../common/Button";
import { submittedQuotationStorageKey } from "./QuotationShell";

type Props = {
  data: QuotationData;
  onBack?: () => void;
  readOnly?: boolean;
  onCreateAnother?: () => void;
};

function serviceDuration(date: ServiceDate): string {
  return date.durationMode ? getDurationLabel(date) : `${formatTime(date.startTime)} to ${formatTime(date.endTime)}`;
}

export function QuotationReviewStep({ data, onBack, readOnly = false, onCreateAnother }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeQuotationNo, setActiveQuotationNo] = useState(data.quotationNo);
  const pricing = calculateQuotationPricing(data);
  const hasQuotationLevelSettings = Number.isFinite(data.totalCups) && (data.serviceDuration === "HALF_DAY" || data.serviceDuration === "FULL_DAY");
  const quotationDurationLabel = data.serviceDuration === "FULL_DAY" ? "Full Day" : "Half Day";
  const totalBaristasRequired = pricing.minimumBaristas === pricing.requiredBaristas
    ? String(pricing.requiredBaristas) : `${pricing.minimumBaristas}–${pricing.requiredBaristas}`;
  const cartSelectionConflict = hasCartAddonConflict(data.selectedAddons);
  const providedBeverageNames = getAllProvidedBeverageNames(data);
  const selectedPackage = data.packageSnapshot;
  const providedBeveragesByDate = data.serviceDates.map((date) => ({ date, names: getProvidedBeverageNames(data, date.id) }));
  const quotationForSubmission: QuotationData = {
    ...data,
    quotationNo: activeQuotationNo,
    expiresAt: new Date(Date.now() + data.linkExpiryDays * 24 * 60 * 60 * 1000).toISOString(),
    pricingSnapshot: { packageAmount: pricing.packageAmount, subtotal: pricing.subtotal, discountAmount: pricing.discountAmount, total: pricing.total },
    pricingBreakdown: {
      requiredBaristas: pricing.requiredBaristas,
      extraBaristas: pricing.extraBaristas,
      extraBaristaFee: pricing.extraBaristaFee,
      fullDayBaristaFeesByDate: pricing.fullDayBaristaFeesByDate,
      extraServingHoursByDate: pricing.extraServingHoursByDate,
      extraServingHourRate: pricing.extraServingHourRate,
      extraServingHourFeeByDate: pricing.extraServingHourFeeByDate,
      totalExtraServingHourFee: pricing.totalExtraServingHourFee
    }
  };

  useEffect(() => setActiveQuotationNo(data.quotationNo), [data.quotationNo]);

  function afterQuotationNumberPaint(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }

  function drinkSelection() {
    return <div className="drink-preferences-summary">{providedBeveragesByDate.map(({ date, names }) => (
      <div key={date.id}><strong>{formatCompactDate(date.serviceDate)} — {hasQuotationLevelSettings ? quotationDurationLabel : serviceDuration(date)}</strong><p>Selected drinks: {names.join(", ") || "None"}</p></div>
    ))}</div>;
  }

  async function downloadQuotation() {
    setSubmitError("");
    try {
      const filename = `Hour-Coffee-Quotation-${activeQuotationNo || "Preview"}.pdf`;
      downloadPdfBlob(await generatePdfBlob("quotationPreview", { filename }), filename);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to generate the quotation PDF.");
    }
  }

  async function submitQuotation() {
    setSubmitError("");
    if (cartSelectionConflict) return setSubmitError(CART_SELECTION_ERROR);
    setIsSubmitting(true);
    try {
      const saved = await submitQuotationWithPdf(quotationForSubmission, async (quotationNo) => {
        setActiveQuotationNo(quotationNo);
        await afterQuotationNumberPaint();
      });
      window.localStorage.setItem(submittedQuotationStorageKey, JSON.stringify({ quotationNo: saved.quotationNo, status: "submitted", submittedAt: new Date().toISOString() }));
      router.push(`/quotation/submitted?quotationNo=${encodeURIComponent(saved.quotationNo)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit quotation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <div className="quotation-review-step">
    <div className="print-document quotation-print-document">
      <div className={`invoice-card quotation-card ${pdfStyles.document}`} id="quotationPreview">
        <div className="invoice-header">
          <div><div className="invoice-title">QUOTATION</div><div className="invoice-meta">
            <div><span>Quotation No</span><strong>{activeQuotationNo}</strong></div>
            <div><span>Quotation Date</span><strong>{formatCompactDate(readOnly && data.createdAt ? new Date(data.createdAt) : new Date())}</strong></div>
            <div><span>Status</span><strong>{readOnly ? (data.status ?? "PENDING_APPROVAL").replaceAll("_", " ") : "Preview"}</strong></div>
          </div></div>
          <div className="invoice-brand">Hour Coffee<span>Coffee Catering</span></div>
        </div>

        <div className="invoice-two-col">
          <div><span className="label-small">Prepared By</span><strong>HOUR COFFEE</strong><p>21, Jalan SS22/40, Damansara Jaya, 47400, Petaling Jaya, Selangor</p><p>contact@hourcoffee.com.my</p></div>
          <div><span className="label-small">Prepared For</span><strong>{data.customer.name}</strong><p>{data.customer.phone}</p><p>{data.customer.email}</p></div>
        </div>

        <div className="invoice-section">
          <h3>Event / Order Details</h3>
          <div className="invoice-summary-grid">
            <div><span>Event address</span><strong>{data.fullAddress || data.location}</strong></div>
            <div><span>Total cups</span><strong>{pricing.totalCups}</strong></div>
            <div><span>Service dates</span><strong>{data.serviceDates.length}</strong></div>
            {selectedPackage ? <div><span>Package</span><strong>{selectedPackage.name}</strong></div> : null}
            {hasQuotationLevelSettings ? <div><span>Service duration</span><strong>{quotationDurationLabel}</strong></div> : null}
            <div><span>Baristas per service date</span><strong>{totalBaristasRequired}</strong></div>
            {hasQuotationLevelSettings ? <div><span>Extra barista units (all dates)</span><strong>{pricing.extraBaristas}</strong></div> : null}
            {hasQuotationLevelSettings ? <div><span>Extra barista fee (included in package)</span><strong>{formatMoney(pricing.extraBaristaFee)}</strong></div> : null}
          </div>
          <div className="table-scroll"><table className="invoice-table compact invoice-service-table">
            <thead><tr><th>Selected Service Dates</th><th>Baristas</th></tr></thead>
            <tbody>{data.serviceDates.map((date) => <tr key={date.id}><td className="date-cell">{formatCompactDate(date.serviceDate)} — {hasQuotationLevelSettings ? quotationDurationLabel : serviceDuration(date)}</td><td>{pricing.perDate.find((entry) => entry.date === date.serviceDate)?.requiredBaristas ?? "—"}</td></tr>)}</tbody>
          </table></div>
        </div>

        <div className="quotation-page-two" style={{ breakBefore: "page", pageBreakBefore: "always" }} />
        {selectedPackage ? <div className="invoice-section"><h3>Package Inclusions</h3><ul>{selectedPackage.perks.map((perk) => <li key={perk.id}>{perk.name}</li>)}</ul></div> : <div className="invoice-section"><h3>Selected Drinks</h3>{drinkSelection()}</div>}

        <table className="invoice-table invoice-item-table">
          <thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>{selectedPackage?.name ?? "Coffee Catering"}</td><td>{selectedPackage ? selectedPackage.briefDescription || "Quotation package" : providedBeverageNames.join(", ") || "Selected beverages"}</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(pricing.packageAmount)}</td><td className="amount-cell">{formatMoney(pricing.packageAmount)}</td></tr>
            {(data.extraCharges ?? []).map((charge) => <tr key={charge.id}><td>{charge.title}</td><td>{charge.description}<div>Applies to: {extraChargeDateLabel(charge, data.serviceDates)}</div></td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(charge.amount)}</td><td className="amount-cell">{formatMoney(charge.amount)}</td></tr>)}
          </tbody>
        </table>

        <div className={pdfStyles.closing}>
        <div className="invoice-totals">
          <div><span>Subtotal</span><strong>{formatMoney(pricing.subtotal)}</strong></div>
          {pricing.discountAmount > 0 ? <div><span>Discount</span><strong>-{formatMoney(pricing.discountAmount)}</strong></div> : null}
          <div className="final"><span>Total RM</span><strong>{formatMoney(pricing.total)}</strong></div>
        </div>
        <section className={pdfStyles.bank}>
          <h3>Bank Details</h3>
          <dl><div><dt>Account Name</dt><dd>HOUR COFFEE</dd></div><div><dt>Account Number</dt><dd>3242195227</dd></div><div><dt>Bank</dt><dd>PUBLIC BANK BERHAD</dd></div></dl>
        </section>
        </div>
        <footer><strong>Hour Coffee</strong><span>For enquiries · contact@hourcoffee.com.my</span></footer>
      </div>
    </div>

    <div className="screen-only">
      <div className="step-intro"><h2>{readOnly ? "Quotation Summary" : "Review & Submit"}</h2>{!readOnly ? <p className="step-copy">Review your event details before submitting your quotation.</p> : null}</div>

      <div className="quotation-review-grid">
        <section className="review-premium-card review-personal-card">
          <h3 className="review-column-title">Personal Info</h3>
          <strong className="review-person-name">{data.customer.name}</strong>
          <div className="review-person-details">
            <div><span>Phone</span><strong>{data.customer.phone}</strong></div>
            <div><span>Email</span><a href={`mailto:${data.customer.email}`}>{data.customer.email}</a></div>
            <div><span>Event Address</span><strong>{data.fullAddress || data.location}</strong></div>
            {data.discountCode ? <div><span>Discount Code</span><strong>{data.discountCode}</strong></div> : null}
          </div>
        </section>

        <section className="review-premium-card review-summary-card">
          <h3 className="review-column-title">Quotation Summary</h3>
          <div className="review-selected-dates">
            <span className="review-summary-heading">Selected Dates</span>
            <div>{data.serviceDates.map((date) => <strong key={date.id}>{formatCompactDate(date.serviceDate)} — {hasQuotationLevelSettings ? quotationDurationLabel : serviceDuration(date)}</strong>)}</div>
          </div>
          <div className="review-summary-rows">
            <div><span>Total Cups</span><strong>{pricing.totalCups}</strong></div>
            <div><span>Baristas per service date</span><strong>{totalBaristasRequired}</strong></div>
            <div className="review-fee-start"><span>{selectedPackage?.name ?? "Quotation"} package</span><strong>{formatMoney(pricing.packageAmount)}</strong></div>
            {(data.extraCharges ?? []).map((charge) => <div key={charge.id}><span>{charge.title}<small> · Applies to: {extraChargeDateLabel(charge, data.serviceDates)}</small></span><strong>{formatMoney(charge.amount)}</strong></div>)}
            {pricing.discountAmount > 0 ? <div className="review-subtotal"><span>Subtotal</span><strong>{formatMoney(pricing.subtotal)}</strong></div> : null}
            {pricing.discountAmount > 0 ? <div><span>Discount</span><strong>-{formatMoney(pricing.discountAmount)}</strong></div> : null}
            <div className="review-final-total"><span>Total</span><strong>{formatMoney(pricing.total)}</strong></div>
          </div>
        </section>
      </div>

      {readOnly ? <div className="readonly-reference"><span>Quotation No.</span><strong>{activeQuotationNo}</strong></div> : null}
      {cartSelectionConflict ? <div className="warn-summary">{CART_SELECTION_ERROR}</div> : null}
      <div className="final-action-section">
        {readOnly ? <><Button type="button" variant="secondary" onClick={downloadQuotation}>Download Quotation</Button><Button type="button" onClick={onCreateAnother}>Create Another Quotation</Button></> : <div className="review-submit-row"><Button type="button" variant="secondary" onClick={onBack}>BACK</Button><Button type="button" onClick={submitQuotation} disabled={isSubmitting}>{isSubmitting ? "SUBMITTING..." : "SUBMIT"}</Button></div>}
        {submitError ? <p className="error">{submitError}</p> : null}
      </div>
    </div>
  </div>;
}
