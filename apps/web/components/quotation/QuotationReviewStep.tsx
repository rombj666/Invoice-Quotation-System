"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { QuotationData, ServiceDate } from "../../types/quotation";
import { CART_SELECTION_ERROR, getAddonDisplayName, getAddonPrice, hasCartAddonConflict } from "../../lib/addons";
import { calculateQuotationPricing, getBaristasNeeded, getDurationLabel, getExtraBaristaFee } from "../../lib/pricing";
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
  const addonAmount = pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee;
  const totalBaristasRequired = hasQuotationLevelSettings
    ? pricing.requiredBaristas
    : Math.max(0, ...data.serviceDates.map((date) => getBaristasNeeded(date)));
  const cartSelectionConflict = hasCartAddonConflict(data.selectedAddons);
  const providedBeverageNames = getAllProvidedBeverageNames(data);
  const selectedPackage = data.packageSnapshot;
  const providedBeveragesByDate = data.serviceDates.map((date) => ({ date, names: getProvidedBeverageNames(data, date.id) }));
  const quotationForSubmission: QuotationData = {
    ...data,
    quotationNo: activeQuotationNo,
    expiresAt: new Date(Date.now() + data.linkExpiryDays * 24 * 60 * 60 * 1000).toISOString(),
    pricingSnapshot: { subtotal: pricing.subtotal, discountAmount: pricing.discountAmount, total: pricing.total },
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

  function addOnNames() {
    return [
      ...data.selectedAddons.map((addon) => `${getAddonDisplayName(addon.name)} (${formatMoney(getAddonPrice(addon))})`),
      data.hasCupStickers ? `Custom Cup Stickers (${formatMoney(pricing.cupStickerFee)})` : "",
      data.hasCupSleeves ? `Custom Cup Sleeves (${formatMoney(pricing.cupSleeveFee)})` : ""
    ].filter(Boolean);
  }

  function drinkSelection() {
    return <div className="drink-preferences-summary">{providedBeveragesByDate.map(({ date, names }) => (
      <div key={date.id}><strong>{formatCompactDate(date.serviceDate)}</strong><p>Selected drinks: {names.join(", ") || "None"}</p></div>
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
      <div className="invoice-card quotation-card" id="quotationPreview">
        <div className="invoice-header">
          <div><div className="invoice-title">QUOTATION</div><div className="invoice-meta">
            <div><span>Quotation No</span><strong>{activeQuotationNo}</strong></div>
            <div><span>Quote Date</span><strong>{formatCompactDate(readOnly && data.createdAt ? new Date(data.createdAt) : new Date())}</strong></div>
            <div><span>Status</span><strong>{readOnly ? (data.status ?? "PENDING_APPROVAL").replaceAll("_", " ") : "Preview"}</strong></div>
          </div></div>
          <div className="invoice-brand">Hour Coffee</div>
        </div>

        <div className="invoice-two-col">
          <div><span className="label-small">Prepared By</span><strong>HOUR COFFEE</strong><p>21, Jalan SS22/40, Damansara Jaya, 47400, Petaling Jaya, Selangor</p><p>contact@hourcoffee.com.my</p></div>
          <div><span className="label-small">Prepared For</span><strong>{data.customer.name}</strong><p>{data.customer.phone}</p><p>{data.customer.email}</p></div>
        </div>

        <div className="invoice-section">
          <h3>Event Summary</h3>
          <div className="invoice-summary-grid">
            <div><span>Event address</span><strong>{data.fullAddress || data.location}</strong></div>
            <div><span>Total cups</span><strong>{pricing.totalCups}</strong></div>
            <div><span>Service dates</span><strong>{data.serviceDates.length}</strong></div>
            {selectedPackage ? <div><span>Package</span><strong>{selectedPackage.name}</strong></div> : null}
            {hasQuotationLevelSettings ? <div><span>Service duration</span><strong>{quotationDurationLabel}</strong></div> : null}
            <div><span>Baristas Provided</span><strong>{totalBaristasRequired}</strong></div>
            {hasQuotationLevelSettings ? <div><span>Extra baristas</span><strong>{pricing.extraBaristas}</strong></div> : null}
            {hasQuotationLevelSettings ? <div><span>Extra barista fee</span><strong>{formatMoney(pricing.extraBaristaFee)}</strong></div> : null}
          </div>
          {hasQuotationLevelSettings ? <div className="table-scroll"><table className="invoice-table compact invoice-service-table">
            <thead><tr><th>Selected service dates</th></tr></thead>
            <tbody>{data.serviceDates.map((date) => <tr key={date.id}><td className="date-cell">{formatCompactDate(date.serviceDate)}</td></tr>)}</tbody>
          </table></div> : <div className="table-scroll"><table className="invoice-table compact invoice-service-table">
            <thead><tr><th>Date</th><th>Duration</th><th>Cups</th><th>Baristas</th><th>Full-day charge</th></tr></thead>
            <tbody>{data.serviceDates.map((date) => <tr key={date.id}>
              <td className="date-cell">{formatCompactDate(date.serviceDate)}</td><td>{serviceDuration(date)}</td><td className="number-cell">{date.cups}</td><td className="number-cell">{getBaristasNeeded(date)}</td><td className="amount-cell">{date.durationMode === "FULL_DAY" ? formatMoney(getExtraBaristaFee(date)) : "—"}</td>
            </tr>)}</tbody>
          </table></div>}
        </div>

        {selectedPackage ? <div className="invoice-section"><h3>Package Inclusions</h3><ul>{selectedPackage.perks.map((perk) => <li key={perk.id}>{perk.name}</li>)}</ul></div> : <div className="invoice-section"><h3>Selected Drinks</h3>{drinkSelection()}</div>}

        <table className="invoice-table invoice-item-table">
          <thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>{selectedPackage?.name ?? "Coffee Catering"}</td><td>{selectedPackage ? selectedPackage.briefDescription || "Quotation package" : providedBeverageNames.join(", ") || "Selected beverages"}</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(pricing.baseAmount)}</td><td className="amount-cell">{formatMoney(pricing.baseAmount)}</td></tr>
            {hasQuotationLevelSettings && pricing.extraBaristaFee > 0 ? <tr><td>Extra Barista Fee</td><td>{pricing.extraBaristas} extra barista(s) · {quotationDurationLabel}</td><td className="number-cell">{pricing.extraBaristas}</td><td className="amount-cell">RM100.00</td><td className="amount-cell">{formatMoney(pricing.extraBaristaFee)}</td></tr> : null}
            {pricing.fullDayBaristaFeesByDate.map((entry) => <tr key={`full-day-${entry.serviceDateId}`}><td>Full-Day Barista Charge</td><td>{formatCompactDate(entry.date)} · {entry.cups} cups · {entry.baristas} barista(s)</td><td className="number-cell">{entry.baristas}</td><td className="amount-cell">RM100.00</td><td className="amount-cell">{formatMoney(entry.fee)}</td></tr>)}
            {!hasQuotationLevelSettings && !pricing.fullDayBaristaFeesByDate.length && pricing.extraBaristaFee > 0 ? <tr><td>Additional Barista Fee</td><td>Legacy service calculation</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(pricing.extraBaristaFee)}</td><td className="amount-cell">{formatMoney(pricing.extraBaristaFee)}</td></tr> : null}
            {pricing.extraServingHoursByDate.filter((entry) => entry.fee > 0).map((entry) => <tr key={`legacy-hours-${entry.serviceDateId}`}><td>Extra Serving Hour</td><td>{formatCompactDate(entry.date)} · legacy service calculation</td><td className="number-cell">{entry.extraServingHours}</td><td className="amount-cell">{formatMoney(entry.rate)}</td><td className="amount-cell">{formatMoney(entry.fee)}</td></tr>)}
            {pricing.machineRentalFee > 0 ? <tr><td>Machine Rental</td><td>Additional coffee machine rental</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(pricing.machineRentalFee)}</td><td className="amount-cell">{formatMoney(pricing.machineRentalFee)}</td></tr> : null}
            {addonAmount > 0 ? <tr><td>Add-ons</td><td>{addOnNames().join(", ")}</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(addonAmount)}</td><td className="amount-cell">{formatMoney(addonAmount)}</td></tr> : null}
            {(data.extraCharges ?? []).map((charge) => <tr key={charge.id}><td>{charge.title}</td><td>{charge.description || "Manual quotation charge"}</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(charge.amount)}</td><td className="amount-cell">{formatMoney(charge.amount)}</td></tr>)}
          </tbody>
        </table>

        <div className="invoice-totals">
          <div><span>Subtotal</span><strong>{formatMoney(pricing.subtotal)}</strong></div>
          {pricing.discountAmount > 0 ? <div><span>Discount</span><strong>-{formatMoney(pricing.discountAmount)}</strong></div> : null}
          <div className="final"><span>Total RM</span><strong>{formatMoney(pricing.total)}</strong></div>
        </div>
        <footer>Prepared by Hour Coffee.</footer>
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
            <div>{data.serviceDates.map((date) => <strong key={date.id}>{formatCompactDate(date.serviceDate)}</strong>)}</div>
          </div>
          <div className="review-summary-rows">
            <div><span>Total Cups</span><strong>{pricing.totalCups}</strong></div>
            <div><span>Baristas Provided</span><strong>{totalBaristasRequired}</strong></div>
            <div className="review-fee-start"><span>Coffee Catering</span><strong>{formatMoney(pricing.baseAmount)}</strong></div>
            <div><span>Extra Barista Fee</span><strong>{formatMoney(pricing.extraBaristaFee)}</strong></div>
            <div><span>Add-on Fee</span><strong>{formatMoney(addonAmount)}</strong></div>
            {pricing.totalExtraServingHourFee > 0 ? <div><span>Extra Serving Hour</span><strong>{formatMoney(pricing.totalExtraServingHourFee)}</strong></div> : null}
            {pricing.machineRentalFee > 0 ? <div><span>Machine Rental</span><strong>{formatMoney(pricing.machineRentalFee)}</strong></div> : null}
            {(data.extraCharges ?? []).map((charge) => <div key={charge.id}><span>{charge.title}</span><strong>{formatMoney(charge.amount)}</strong></div>)}
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
