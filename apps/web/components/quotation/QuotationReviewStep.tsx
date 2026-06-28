"use client";

import type { QuotationData } from "../../types/quotation";
import { calculatePricing, getBaristasNeeded } from "../../lib/pricing";
import { saveQuotationLocally } from "../../lib/quotation-storage";
import { formatDateLabel, formatMoney, formatTime } from "../../lib/formatters";
import { useState } from "react";
import { Button } from "../common/Button";

const PARTNER_WHATSAPP_NUMBER = "601XXXXXXXX";

type Props = {
  data: QuotationData;
  onBack: () => void;
  onReset: () => void;
};

export function QuotationReviewStep({ data, onBack, onReset }: Props) {
  const [submitMessage, setSubmitMessage] = useState("");
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
  const invoicePath = "/invoice";
  const drinkNames = [
    ["americano", "Americano"],
    ["latte", "Cafe Latte"],
    ["chocolate", "Dark Chocolate"],
    ["lemonade", "Lemonade"]
  ] as const;

  function drinkLabel(dateId: string, drinkId: (typeof drinkNames)[number][0]) {
    const qty = data.drinkOrders[dateId]?.[drinkId] ?? { ice: 0, hot: 0 };
    return `Ice ${qty.ice}${drinkId === "lemonade" ? "" : `, Hot ${qty.hot}`}`;
  }

  async function submitQuotation() {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      await saveQuotationLocally({ ...quotationForInvoice, status: "PENDING_APPROVAL" });
      setSubmitMessage("Your quotation has been submitted. Our PIC or partner will review it and contact you before the invoice and payment step.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to submit quotation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function contactPartner() {
    const dateLines = data.serviceDates.map((date) => `${formatDateLabel(date.serviceDate)}: ${formatTime(date.startTime)} to ${formatTime(date.endTime)}, ${date.cups} cups`).join("\n");
    const drinkLines = data.serviceDates
      .map((date) => {
        const drinks = Object.entries(data.drinkOrders[date.id] ?? {})
          .map(([name, qty]) => `${name} ice ${qty.ice}, hot ${qty.hot}`)
          .join("; ");
        return `${formatDateLabel(date.serviceDate)}: ${drinks}`;
      })
      .join("\n");
    const addonLines = [...data.selectedAddons.map((addon) => `${addon.name} ${formatMoney(addon.price)}`), data.hasCupStickers ? "Custom Cup Stickers" : "", data.hasCupSleeves ? "Custom Cup Sleeves" : ""]
      .filter(Boolean)
      .join(", ");
    const message = `Hour Coffee Quotation Review
Quotation No.: ${data.quotationNo}
Status: PENDING_APPROVAL
Customer: ${data.customer.name}
Phone: ${data.customer.phone}
Email: ${data.customer.email}
Company: ${data.customer.companyName || "-"}
Billing address: ${data.customer.billingAddress}
Location: ${data.location}
Event type: ${data.eventType === "Others" ? data.customEventType : data.eventType}
Service dates:
${dateLines}
Drink distribution:
${drinkLines}
Same drink distribution: ${data.sameDrinkDistribution ? "Yes" : "No"}
Add-ons: ${addonLines || "None"}
Customization options:
Cart ${data.customizationOptions.cart.mode}, ${data.customizationOptions.cart.designCount} design(s)
Sticker ${data.customizationOptions.sticker.mode}, ${data.customizationOptions.sticker.designCount} design(s)
Sleeve ${data.customizationOptions.sleeve.mode}, ${data.customizationOptions.sleeve.designCount} design(s)
Subtotal: ${formatMoney(pricing.subtotal)}
Voucher/Discount: ${data.discountCode || "None"} / ${formatMoney(pricing.discountAmount)}
Total: ${formatMoney(pricing.total)}`;
    window.location.href = `https://wa.me/${PARTNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
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
                  <tr key={date.id}><td>{formatDateLabel(date.serviceDate)}</td><td>{formatTime(date.startTime)} to {formatTime(date.endTime)}</td><td>{date.cups}</td><td>{getBaristasNeeded(date)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="review-section">
          <span>Drink distribution</span>
          <div className="table-scroll">
            <table className="summary-table">
              <thead><tr><th>Date</th>{drinkNames.map(([, name]) => <th key={name}>{name}</th>)}</tr></thead>
              <tbody>
                {data.serviceDates.map((date) => (
                  <tr key={date.id}><td>{formatDateLabel(date.serviceDate)}</td>{drinkNames.map(([id]) => <td key={id}>{drinkLabel(date.id, id)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="review-section">
          <span>Add-ons</span>
          <div className="table-scroll">
            <table className="summary-table">
              <thead><tr><th>Add-on</th><th>Details</th><th>Amount</th></tr></thead>
              <tbody>
                {data.selectedAddons.map((addon) => <tr key={addon.name}><td>{addon.name}</td><td>{addon.isIncluded ? "Included" : "Selected"}</td><td>{formatMoney(addon.price)}</td></tr>)}
                {data.hasCupStickers ? <tr><td>Custom Cup Stickers</td><td>{data.customizationOptions.sticker.mode}, {data.customizationOptions.sticker.designCount} design(s)</td><td>{formatMoney(pricing.cupStickerFee)}</td></tr> : null}
                {data.hasCupSleeves ? <tr><td>Custom Cup Sleeves</td><td>{data.customizationOptions.sleeve.mode}, {data.customizationOptions.sleeve.designCount} design(s)</td><td>{formatMoney(pricing.cupSleeveFee)}</td></tr> : null}
                {!data.selectedAddons.length && !data.hasCupStickers && !data.hasCupSleeves ? <tr><td>None</td><td>-</td><td>{formatMoney(0)}</td></tr> : null}
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
        {submitMessage ? <div className="ok-summary">{submitMessage}</div> : null}
      </div>
      <div className="final-action-section">
        <h3>Need to discuss first?</h3>
        <p>Contact our partner/PIC on WhatsApp with your quotation details. The message will be prepared automatically so they can review your event requirements.</p>
        <Button type="button" variant="secondary" onClick={contactPartner}>
          Contact Partner on WhatsApp
        </Button>
      </div>
      {submitMessage ? (
        <div className="final-action-section">
          <h3>Invoice</h3>
          <p>You can open the invoice page after submission. If this quotation is not approved yet, the invoice page will show the pending approval message.</p>
          <a className="hc-button hc-button-primary" href={invoicePath}>
            Continue to Invoice
          </a>
        </div>
      ) : null}
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
