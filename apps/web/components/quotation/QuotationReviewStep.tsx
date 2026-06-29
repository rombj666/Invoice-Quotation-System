"use client";

import { useRouter } from "next/navigation";
import type { QuotationData } from "../../types/quotation";
import { calculatePricing, getBaristasNeeded } from "../../lib/pricing";
import { openPartnerWhatsApp } from "../../lib/contact";
import { saveQuotationLocally } from "../../lib/quotation-storage";
import { formatCompactDate, formatMoney, formatTime } from "../../lib/formatters";
import { useState } from "react";
import { Button } from "../common/Button";

type Props = {
  data: QuotationData;
  onBack: () => void;
  onReset: () => void;
};

export function QuotationReviewStep({ data, onBack, onReset }: Props) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pricing = calculatePricing(data);
  const quotationForInvoice = {
    ...data,
    expiresAt: new Date(Date.now() + data.linkExpiryDays * 24 * 60 * 60 * 1000).toISOString(),
    pricingSnapshot: {
      subtotal: pricing.subtotal,
      discountAmount: pricing.discountAmount,
      total: pricing.total
    }
  };
  const drinkNames = [
    ["americano", "Americano"],
    ["latte", "Cafe Latte"],
    ["chocolate", "Dark Chocolate"],
    ["lemonade", "Lemonade"]
  ] as const;

  function drinkLabel(dateId: string, drinkId: (typeof drinkNames)[number][0]) {
    const qty = data.drinkOrders[dateId]?.[drinkId] ?? { ice: 0, hot: 0 };
    return drinkId === "lemonade" ? `${qty.ice}` : `${qty.ice} / ${qty.hot}`;
  }

  async function submitQuotation() {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const saved = await saveQuotationLocally({ ...quotationForInvoice, status: "PENDING_APPROVAL" });
      router.push(`/quotation/submitted?quotationNo=${encodeURIComponent(saved.quotationNo)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit quotation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function contactPartner() {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const saved = await saveQuotationLocally({ ...quotationForInvoice, status: "PENDING_APPROVAL" });
      openPartnerWhatsApp(saved);
      router.push(`/quotation/contacted?quotationNo=${encodeURIComponent(saved.quotationNo)}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save quotation before opening WhatsApp. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <h2>Review & Generate</h2>
      <p className="step-copy">Confirm the quotation before submitting it for review.</p>

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
          {data.sameDrinkDistribution || data.letHourCoffeeDecideDrinks ? (
            <div className="ok-summary">Hour Coffee will decide the final drink ratio and distribution for this event.</div>
          ) : (
            <div className="table-scroll">
              <table className="summary-table drink-summary-table">
                <thead><tr><th>Date</th>{drinkNames.map(([id, name]) => <th key={id}>{name}<small>{id === "lemonade" ? "Qty" : "Ice / Hot"}</small></th>)}</tr></thead>
                <tbody>
                  {data.serviceDates.map((date) => (
                    <tr key={date.id}><td className="date-cell">{formatCompactDate(date.serviceDate)}</td>{drinkNames.map(([id]) => <td className="number-cell" key={id}>{drinkLabel(date.id, id)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="review-section">
          <span>Add-ons</span>
          <div className="table-scroll">
            <table className="summary-table">
              <thead><tr><th>Add-on</th><th>Amount</th></tr></thead>
              <tbody>
                {data.selectedAddons.map((addon) => <tr key={addon.name}><td>{addon.name}</td><td className="amount-cell">{formatMoney(addon.price)}</td></tr>)}
                {data.hasCupStickers ? <tr><td>Custom Cup Stickers ({data.customizationOptions.sticker.mode}, {data.customizationOptions.sticker.designCount} design(s))</td><td className="amount-cell">{formatMoney(pricing.cupStickerFee)}</td></tr> : null}
                {data.hasCupSleeves ? <tr><td>Custom Cup Sleeves ({data.customizationOptions.sleeve.mode}, {data.customizationOptions.sleeve.designCount} design(s))</td><td className="amount-cell">{formatMoney(pricing.cupSleeveFee)}</td></tr> : null}
                {!data.selectedAddons.length && !data.hasCupStickers && !data.hasCupSleeves ? <tr><td>None</td><td className="amount-cell">{formatMoney(0)}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="review-section">
          <span>Pricing</span>
          <div className="total-box">
            <div><span>Base</span><strong>{formatMoney(pricing.baseAmount)}</strong></div>
            <div><span>Setup fee</span><strong>{formatMoney(pricing.setupFee)}</strong></div>
            <div><span>Extra barista fee</span><strong>{formatMoney(pricing.extraBaristaFee)}</strong></div>
            <div><span>Machine rental</span><strong>{formatMoney(pricing.machineRentalFee)}</strong></div>
            <div><span>Add-ons</span><strong>{formatMoney(pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee)}</strong></div>
            <div><span>Discount</span><strong>{formatMoney(pricing.discountAmount)}</strong></div>
            <div className="final"><span>Total</span><strong>{formatMoney(pricing.total)}</strong></div>
          </div>
        </div>
        <div className="review-section">
          <span>Reference</span>
          <div className="summary-rows">
            <div><strong>Quotation No.</strong><span>{data.quotationNo}</span></div>
            <div><strong>Status</strong><span>PENDING APPROVAL</span></div>
          </div>
        </div>
      </div>

      <div className="final-action-section">
        <h3>Submit quotation for review</h3>
        <p>Submit this quotation to our team. Our PIC or partner will review the details and contact you if anything needs confirmation. Once approved, you can continue to the invoice and payment step.</p>
        <Button type="button" onClick={submitQuotation} disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Quotation"}
        </Button>
        {submitError ? <p className="error">{submitError}</p> : null}
      </div>
      <div className="final-action-section">
        <h3>Need to discuss first?</h3>
        <p>Contact our partner/PIC on WhatsApp with your quotation details. The message will be prepared automatically so they can review your event requirements.</p>
        <Button type="button" variant="secondary" onClick={contactPartner} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Contact Partner on WhatsApp"}
        </Button>
      </div>
      <div className="hc-nav-row">
        <Button type="button" variant="secondary" onClick={onBack}>
          BACK
        </Button>
        <Button type="button" variant="success" onClick={onReset}>
          New Quotation
        </Button>
      </div>
    </div>
  );
}
