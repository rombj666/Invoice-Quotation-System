"use client";

import { useRouter } from "next/navigation";
import type { QuotationData } from "../../types/quotation";
import { CART_SELECTION_ERROR, getAddonDisplayName, getAddonPrice, hasCartAddonConflict } from "../../lib/addons";
import { calculateQuotationPricing, getBaristasNeeded } from "../../lib/pricing";
import { saveQuotationLocally } from "../../lib/quotation-storage";
import { formatCompactDate, formatMoney, formatTime } from "../../lib/formatters";
import { useState } from "react";
import { Button } from "../common/Button";
import { submittedQuotationStorageKey } from "./QuotationShell";
import { downloadPdfBlob, generatePdfBlob } from "../../lib/pdf-document";

type Props = {
  data: QuotationData;
  onBack?: () => void;
  onReset?: () => void;
  readOnly?: boolean;
  onCreateAnother?: () => void;
};

export function QuotationReviewStep({ data, onBack, readOnly = false, onCreateAnother }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pricing = calculateQuotationPricing(data);
  const addonAmount = pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee;
  const hasOptionalAddons = data.selectedAddons.length > 0 || data.hasCupStickers || data.hasCupSleeves;
  const cartSelectionConflict = hasCartAddonConflict(data.selectedAddons);
  const quotationForInvoice = {
    ...data,
    expiresAt: new Date(Date.now() + data.linkExpiryDays * 24 * 60 * 60 * 1000).toISOString(),
    pricingSnapshot: {
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      total: pricing.total
    }
  };
  const drinkColumns = [
    ["americano", "ice", "Americano Ice"],
    ["americano", "hot", "Americano Hot"],
    ["latte", "ice", "Cafe Latte Ice"],
    ["latte", "hot", "Cafe Latte Hot"],
    ["chocolate", "ice", "Dark Chocolate Ice"],
    ["chocolate", "hot", "Dark Chocolate Hot"],
    ["lemonade", "ice", "Lemonade"]
  ] as const;

  function drinkQuantity(dateId: string, drinkId: (typeof drinkColumns)[number][0], type: (typeof drinkColumns)[number][1]) {
    const qty = data.drinkOrders[dateId]?.[drinkId] ?? { ice: 0, hot: 0 };
    return qty[type];
  }

  function addOnNames() {
    return [
      ...data.selectedAddons.map((addon) => `${getAddonDisplayName(addon.name)} (${formatMoney(getAddonPrice(addon))})`),
      data.hasCupStickers ? `Custom Cup Stickers (${formatMoney(pricing.cupStickerFee)})` : "",
      data.hasCupSleeves ? `Custom Cup Sleeves (${formatMoney(pricing.cupSleeveFee)})` : ""
    ].filter(Boolean);
  }

  async function downloadQuotation() {
    setSubmitError("");
    try {
      const filename = `Hour-Coffee-Quotation-${data.quotationNo || "Preview"}.pdf`;
      const pdf = await generatePdfBlob("quotationPreview", { filename });
      downloadPdfBlob(pdf, filename);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to generate the quotation PDF.");
    }
  }

  async function submitQuotation() {
    setSubmitError("");
    if (cartSelectionConflict) {
      setSubmitError(CART_SELECTION_ERROR);
      return;
    }
    setIsSubmitting(true);
    try {
      const filename = `Hour-Coffee-Quotation-${data.quotationNo}.pdf`;
      let quotationPdf: Blob;
      try {
        quotationPdf = await generatePdfBlob("quotationPreview", { filename });
        console.info("[quotation-pdf] pdf_generation", { quotationNo: data.quotationNo, success: true, bytes: quotationPdf.size });
      } catch (error) {
        console.error("[quotation-pdf] pdf_generation", {
          quotationNo: data.quotationNo,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        throw new Error("Quotation submission failed because the PDF could not be generated. Please try again.");
      }
      const saved = await saveQuotationLocally({ ...quotationForInvoice, status: "PENDING_APPROVAL" }, quotationPdf);
      if (!saved.quotationPdfUrl || !saved.quotationPdfPublicId) {
        console.error("[quotation-pdf] submission_verification", {
          quotationNo: saved.quotationNo,
          success: false,
          quotationPdfUrl: saved.quotationPdfUrl ?? null,
          quotationPdfPublicId: saved.quotationPdfPublicId ?? null
        });
        throw new Error("Quotation submission was not completed because PDF storage could not be verified. Please try again.");
      }
      window.localStorage.setItem(submittedQuotationStorageKey, JSON.stringify({
        quotationNo: saved.quotationNo,
        status: "submitted",
        submittedAt: new Date().toISOString()
      }));
      router.push(`/quotation/submitted?quotationNo=${encodeURIComponent(saved.quotationNo)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit quotation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="print-document quotation-print-document">
        <div className="invoice-card quotation-card" id="quotationPreview">
          <div className="invoice-header">
            <div>
              <div className="invoice-title">QUOTATION</div>
              <div className="invoice-meta">
                <div>
                  <span>Quotation No</span>
                  <strong>{data.quotationNo}</strong>
                </div>
                <div>
                  <span>Quote Date</span>
                  <strong>{formatCompactDate(readOnly && data.createdAt ? new Date(data.createdAt) : new Date())}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong>{readOnly ? (data.status ?? "PENDING_APPROVAL").replaceAll("_", " ") : "Preview"}</strong>
                </div>
              </div>
            </div>
            <div className="invoice-brand">Hour Coffee</div>
          </div>

          <div className="invoice-two-col">
            <div>
              <span className="label-small">Prepared By</span>
              <strong>HOUR COFFEE</strong>
              <p>21, Jalan SS22/40, Damansara Jaya, 47400, Petaling Jaya, Selangor</p>
              <p>contact@hourcoffee.com.my</p>
            </div>
            <div>
              <span className="label-small">Prepared For</span>
              <strong>{data.customer.companyName || data.customer.name}</strong>
              <p>{data.customer.name}</p>
              <p>{data.customer.phone}</p>
              <p>{data.customer.email}</p>
              <p>{data.customer.billingAddress}</p>
            </div>
          </div>

          <div className="invoice-section">
            <h3>Event Summary</h3>
            <div className="invoice-summary-grid">
              <div><span>Total cups</span><strong>{pricing.totalCups}</strong></div>
              <div><span>Location</span><strong>{data.fullAddress || data.location}</strong></div>
              <div><span>Event type</span><strong>{data.eventType === "Others" ? data.customEventType : data.eventType}</strong></div>
            </div>
            <div className="table-scroll">
              <table className="invoice-table compact invoice-service-table">
                <thead><tr><th>Date</th><th>Time</th><th>Cups</th><th>Barista(s)</th></tr></thead>
                <tbody>
                  {data.serviceDates.map((date) => (
                    <tr key={date.id}><td className="date-cell">{formatCompactDate(date.serviceDate)}</td><td>{formatTime(date.startTime)} to {formatTime(date.endTime)}</td><td className="number-cell">{date.cups}</td><td className="number-cell">{getBaristasNeeded(date)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="invoice-section">
            <h3>Drink Distribution</h3>
            {data.letHourCoffeeDecideDrinks ? (
              <div className="ok-summary">Hour Coffee will decide the final drink ratio and distribution for this event.</div>
            ) : (
              <div className="table-scroll">
                <table className="invoice-table compact drink-summary-table">
                  <thead><tr><th>Date</th>{drinkColumns.map(([id, type, label]) => <th key={`${id}-${type}`}>{label}</th>)}</tr></thead>
                  <tbody>
                    {data.serviceDates.map((date) => (
                      <tr key={date.id}><td className="date-cell">{formatCompactDate(date.serviceDate)}</td>{drinkColumns.map(([id, type]) => <td className="number-cell" key={`${id}-${type}`}>{drinkQuantity(date.id, id, type)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <table className="invoice-table invoice-item-table">
            <thead><tr><th>Item</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>Coffee Catering</td><td>Americano, Cafe Latte, Dark Chocolate, Lemonade</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(pricing.baseAmount)}</td><td className="amount-cell">{formatMoney(pricing.baseAmount)}</td></tr>
              {pricing.extraBaristaFee > 0 ? <tr><td>Additional Barista Fee</td><td>Extra barista(s) required</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(pricing.extraBaristaFee)}</td><td className="amount-cell">{formatMoney(pricing.extraBaristaFee)}</td></tr> : null}
              {pricing.machineRentalFee > 0 ? <tr><td>Machine Rental</td><td>Additional coffee machine rental</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(pricing.machineRentalFee)}</td><td className="amount-cell">{formatMoney(pricing.machineRentalFee)}</td></tr> : null}
              {addonAmount > 0 ? <tr><td>Add-ons</td><td>{addOnNames().join(", ")}</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(addonAmount)}</td><td className="amount-cell">{formatMoney(addonAmount)}</td></tr> : null}
              {(data.extraCharges ?? []).map((charge) => <tr key={charge.id}><td>{charge.title}</td><td>{charge.description || "Manual quotation charge"}</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(charge.amount)}</td><td className="amount-cell">{formatMoney(charge.amount)}</td></tr>)}
            </tbody>
          </table>

          <div className="invoice-totals">
            <div><span>Subtotal</span><strong>{formatMoney(pricing.subtotal)}</strong></div>
            {pricing.discountAmount > 0 ? <div><span>Discount</span><strong>{formatMoney(pricing.discountAmount)}</strong></div> : null}
            <div className="final"><span>Total RM</span><strong>{formatMoney(pricing.total)}</strong></div>
          </div>
          <footer>Quotation preview only. Submission status is unchanged by download.</footer>
        </div>
      </div>

      <div className="screen-only">
      <h2>{readOnly ? "Quotation Summary" : "Review & Generate"}</h2>
      {!readOnly ? <p className="step-copy">Confirm the quotation before submitting it for review.</p> : null}

      <div className="review-box review-table-box">
        <div className="review-section">
          <span>Customer</span>
          <div className="summary-rows">
            <div><strong>Name</strong><span>{data.customer.name}</span></div>
            <div><strong>Phone</strong><span>{data.customer.phone}</span></div>
            <div><strong>Email</strong><span>{data.customer.email}</span></div>
            <div><strong>Company</strong><span>{data.customer.companyName || "-"}</span></div>
            <div><strong>Billing address</strong><span>{data.customer.billingAddress}</span></div>
          </div>
        </div>
        <div className="review-section">
          <span>Event</span>
          <div className="summary-rows">
            <div><strong>Location</strong><span>{data.fullAddress || data.location}</span></div>
            <div><strong>Event type</strong><span>{data.eventType === "Others" ? data.customEventType : data.eventType}</span></div>
          </div>
        </div>
        <div className="review-section">
          <span>Dates and service</span>
          <div className="table-scroll">
            <table className="summary-table">
              <thead><tr><th>Date</th><th>Time</th><th>Cups</th><th>Barista(s)</th></tr></thead>
              <tbody>
                {data.serviceDates.map((date) => (
                  <tr key={date.id}><td className="date-cell">{formatCompactDate(date.serviceDate)}</td><td>{formatTime(date.startTime)} to {formatTime(date.endTime)}</td><td className="number-cell">{date.cups}</td><td className="number-cell">{getBaristasNeeded(date)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="review-section">
          <span>Drink distribution</span>
          {data.letHourCoffeeDecideDrinks ? (
            <div className="ok-summary">Hour Coffee will decide the final drink ratio and distribution for this event.</div>
          ) : (
            <div className="table-scroll">
              <table className="summary-table drink-summary-table">
                <thead><tr><th>Date</th>{drinkColumns.map(([id, type, label]) => <th key={`${id}-${type}`}>{label}</th>)}</tr></thead>
                <tbody>
                  {data.serviceDates.map((date) => (
                    <tr key={date.id}><td className="date-cell">{formatCompactDate(date.serviceDate)}</td>{drinkColumns.map(([id, type]) => <td className="number-cell" key={`${id}-${type}`}>{drinkQuantity(date.id, id, type)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {hasOptionalAddons ? <div className="review-section">
          <span>Add-ons</span>
          <div className="table-scroll">
            <table className="summary-table">
              <thead><tr><th>Add-on</th><th>Amount</th></tr></thead>
              <tbody>
                {data.selectedAddons.map((addon) => {
                  const price = getAddonPrice(addon);
                  return <tr key={addon.name}><td>{getAddonDisplayName(addon.name)}</td><td className="amount-cell">{price > 0 ? formatMoney(price) : "FREE"}</td></tr>;
                })}
                {data.hasCupStickers ? <tr><td>Custom Cup Stickers ({data.customizationOptions.sticker.mode}, {data.customizationOptions.sticker.designCount} design(s))</td><td className="amount-cell">{pricing.cupStickerFee > 0 ? formatMoney(pricing.cupStickerFee) : "FREE"}</td></tr> : null}
                {data.hasCupSleeves ? <tr><td>Custom Cup Sleeves ({data.customizationOptions.sleeve.mode}, {data.customizationOptions.sleeve.designCount} design(s))</td><td className="amount-cell">{pricing.cupSleeveFee > 0 ? formatMoney(pricing.cupSleeveFee) : "FREE"}</td></tr> : null}
              </tbody>
            </table>
          </div>
          {cartSelectionConflict ? <div className="warn-summary">{CART_SELECTION_ERROR}</div> : null}
        </div> : null}
        <div className="review-section">
          <span>Pricing</span>
          <div className="total-box">
            <div><span>Base</span><strong>{formatMoney(pricing.baseAmount)}</strong></div>
            {pricing.extraBaristaFee > 0 ? <div><span>Extra barista fee</span><strong>{formatMoney(pricing.extraBaristaFee)}</strong></div> : null}
            {pricing.machineRentalFee > 0 ? <div><span>Machine rental</span><strong>{formatMoney(pricing.machineRentalFee)}</strong></div> : null}
            {addonAmount > 0 ? <div><span>Add-ons</span><strong>{formatMoney(addonAmount)}</strong></div> : null}
            {(data.extraCharges ?? []).map((charge) => <div key={charge.id}><span>{charge.title}</span><strong>{formatMoney(charge.amount)}</strong></div>)}
            <div><span>Subtotal</span><strong>{formatMoney(pricing.subtotal)}</strong></div>
            {pricing.discountAmount > 0 ? <div><span>Discount</span><strong>{formatMoney(pricing.discountAmount)}</strong></div> : null}
            <div className="final"><span>Total</span><strong>{formatMoney(pricing.total)}</strong></div>
          </div>
        </div>
        <div className="review-section">
          <span>Reference</span>
          <div className="summary-rows">
            <div><strong>Quotation No.</strong><span>{data.quotationNo}</span></div>
            <div><strong>Status</strong><span>{(data.status ?? "PENDING_APPROVAL").replaceAll("_", " ")}</span></div>
          </div>
        </div>
      </div>

      <div className="final-action-section">
        <Button type="button" variant="secondary" onClick={downloadQuotation}>
          Download Quotation
        </Button>
        {readOnly ? (
          <Button type="button" onClick={onCreateAnother}>Create Another Quotation</Button>
        ) : (
          <div className="review-submit-row">
            <Button type="button" variant="secondary" onClick={onBack}>BACK</Button>
            <Button type="button" onClick={submitQuotation} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Quotation"}
            </Button>
          </div>
        )}
        {submitError ? <p className="error">{submitError}</p> : null}
      </div>
      </div>
    </div>
  );
}
