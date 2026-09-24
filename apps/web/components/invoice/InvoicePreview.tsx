"use client";

import type { QuotationData } from "../../types/quotation";
import type { InvoiceDetails } from "../../types/invoice";
import { getBaristasNeeded } from "../../lib/invoice-pricing";
import { calculateQuotationPricing } from "../../lib/pricing";
import { formatCompactDate, formatMoney, formatTime } from "../../lib/formatters";
import { downloadPdfBlob, generatePdfBlob } from "../../lib/pdf-document";
import { getAllProvidedBeverageNames, getProvidedBeverageNames } from "../../lib/beverages";

export function InvoicePreview({
  invoiceNo,
  quotation,
  invoice,
  documentId = "invoicePreview",
  showDownloadButton = true
}: {
  invoiceNo: string;
  quotation: QuotationData;
  invoice?: InvoiceDetails;
  documentId?: string;
  showDownloadButton?: boolean;
}) {
  const pricing = calculateQuotationPricing(quotation);
  const firstDate = quotation.serviceDates[0];
  const beverageNames = getAllProvidedBeverageNames(quotation).join(", ");
  const providedBeveragesByDate = quotation.serviceDates.map((date) => ({ date, names: getProvidedBeverageNames(quotation, date.id) }));
  const hasDateSpecificDrinkPreferences = new Set(providedBeveragesByDate.map(({ names }) => names.join("|"))).size > 1;

  return (
    <div className="invoice-preview-wrap">
    <div className="invoice-card" id={documentId}>
      <div className="invoice-header">
        <div>
          <div className="invoice-title">INVOICE</div>
          <div className="invoice-meta">
            <div>
              <span>Invoice No</span>
              <strong>{invoiceNo}</strong>
            </div>
            <div>
              <span>Invoice Date</span>
              <strong>{formatCompactDate(invoice?.submittedAt ? new Date(invoice.submittedAt) : new Date())}</strong>
            </div>
            <div>
              <span>Quote Ref</span>
              <strong>{quotation.quotationNo}</strong>
            </div>
          </div>
        </div>
        <div className="invoice-brand">Hour Coffee</div>
      </div>

      <div className="invoice-two-col">
        <div>
          <span className="label-small">Billed By</span>
          <strong>HOUR COFFEE</strong>
          <p>21, Jalan SS22/40, Damansara Jaya, 47400, Petaling Jaya, Selangor</p>
          <p>contact@hourcoffee.com.my</p>
        </div>
        <div>
          <span className="label-small">Billed To</span>
          <strong>{quotation.customer.companyName || quotation.customer.name}</strong>
          <p>{quotation.customer.companyRegNo ? `Reg: ${quotation.customer.companyRegNo}` : null}</p>
          <p>{quotation.customer.billingAddress || "-"}</p>
          <p>{quotation.customer.name}</p>
          <p>{quotation.customer.phone}</p>
          <p>{quotation.customer.email}</p>
        </div>
      </div>

      {invoice ? (
        <div className="invoice-section">
          <h3>Event Details</h3>
          <div className="invoice-summary-grid">
            <div><span>Event area</span><strong>{invoice.eventArea === "Others" ? invoice.eventAreaOther || "Others" : invoice.eventArea || "-"}</strong></div>
            <div><span>Event address</span><strong>{invoice.eventAddress || "-"}</strong></div>
            <div><span>Invoice status</span><strong>{(invoice.invoiceStatus ?? "SUBMITTED").replaceAll("_", " ")}</strong></div>
            <div><span>Payment status</span><strong>{(invoice.paymentStatus ?? "UNPAID").replaceAll("_", " ")}</strong></div>
          </div>
        </div>
      ) : null}

      <div className="invoice-section">
        <h3>Event Summary</h3>
        <div className="invoice-summary-grid">
          <div>
            <span>Total cups</span>
            <strong>{pricing.totalCups}</strong>
          </div>
          <div>
            <span>First service time</span>
            <strong>{firstDate ? `${formatTime(firstDate.startTime)} to ${formatTime(firstDate.endTime)}` : "-"}</strong>
          </div>
          <div>
            <span>First date barista(s)</span>
            <strong>{firstDate ? getBaristasNeeded(firstDate) : "-"}</strong>
          </div>
        </div>
        <div className="table-scroll">
          <table className="invoice-table compact invoice-service-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Cups</th>
                <th>Barista(s)</th>
              </tr>
            </thead>
            <tbody>
              {quotation.serviceDates.map((date) => (
                <tr key={date.id}>
                  <td className="date-cell">{formatCompactDate(date.serviceDate)}</td>
                  <td>{formatTime(date.startTime)} to {formatTime(date.endTime)}</td>
                  <td className="number-cell">{date.cups}</td>
                  <td className="number-cell">{getBaristasNeeded(date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <table className="invoice-table invoice-item-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{quotation.packageSnapshot?.name || "Coffee Catering"}</td>
            <td>
              {beverageNames || "Beverages saved with quotation"}
            </td>
            <td className="number-cell">1</td>
            <td className="amount-cell">{formatMoney(pricing.packageAmount)}</td>
            <td className="amount-cell">{formatMoney(pricing.packageAmount)}</td>
          </tr>
          {(quotation.extraCharges ?? []).map((charge) => <tr key={charge.id}><td>{charge.title}</td><td>{charge.description || "Additional charge"}</td><td className="number-cell">1</td><td className="amount-cell">{formatMoney(charge.amount)}</td><td className="amount-cell">{formatMoney(charge.amount)}</td></tr>)}
        </tbody>
      </table>

      {(quotation.packageSnapshot?.perks.length || quotation.selectedAddons.length || quotation.hasCupSleeves || quotation.hasCupStickers) ? <div className="invoice-section"><h3>Package Features &amp; Add-ons</h3><p>{[
        ...(quotation.packageSnapshot?.perks.map((perk) => perk.name) ?? []),
        ...quotation.selectedAddons.map((addon) => addon.name),
        quotation.hasCupSleeves ? "Custom Cup Sleeves" : "",
        quotation.hasCupStickers ? "Custom Cup Stickers" : ""
      ].filter(Boolean).join(", ")}</p></div> : null}

      {quotation.pricingSnapshot ? <div className="invoice-section"><h3>Pricing Breakdown</h3><div className="invoice-summary-grid">
        {quotation.pricingSnapshot.cupRevenue !== undefined ? <div><span>Drinks / cups</span><strong>{formatMoney(quotation.pricingSnapshot.cupRevenue)}</strong></div> : null}
        {quotation.pricingSnapshot.sleeveCharge ? <div><span>Cup sleeves</span><strong>{formatMoney(quotation.pricingSnapshot.sleeveCharge)}</strong></div> : null}
        {quotation.pricingSnapshot.selectionCharge ? <div><span>Package features / add-ons</span><strong>{formatMoney(quotation.pricingSnapshot.selectionCharge)}</strong></div> : null}
        {pricing.extraBaristaFee ? <div><span>Extra baristas</span><strong>{formatMoney(pricing.extraBaristaFee)}</strong></div> : null}
        {quotation.packageSnapshot?.extendedDayCharge ? <div><span>Extended service days</span><strong>{formatMoney(quotation.packageSnapshot.extendedDayCharge)}</strong></div> : null}
        {quotation.pricingSnapshot.travel ? <div><span>Travel</span><strong>{formatMoney(quotation.pricingSnapshot.travel)}</strong></div> : null}
      </div></div> : null}

      {hasDateSpecificDrinkPreferences ? <div className="invoice-section">
        <h3>Drink Preferences</h3>
        <div className="drink-preferences-summary">{providedBeveragesByDate.map(({ date, names }) => <div key={date.id}><strong>{formatCompactDate(date.serviceDate)}</strong><p>Drinks provided: {names.join(", ") || "None"}</p></div>)}</div>
      </div> : null}

      <div className="invoice-totals">
        <div>
          <span>Subtotal</span>
          <strong>{formatMoney(pricing.subtotal)}</strong>
        </div>
        {pricing.discountAmount > 0 ? <div>
          <span>Discount</span>
          <strong>{formatMoney(pricing.discountAmount)}</strong>
        </div> : null}
        <div className="final">
          <span>Total RM</span>
          <strong>{formatMoney(pricing.total)}</strong>
        </div>
      </div>

      <div className="invoice-bank">
        <strong>Bank Details</strong>
        <p>Account Name: HOUR COFFEE</p>
        <p>Account Number: 3242195227</p>
        <p>Bank: PUBLIC BANK BERHAD</p>
      </div>
      <footer>contact@hourcoffee.com.my | WhatsApp +6012-5689129</footer>
    </div>
    {showDownloadButton ? <button className="pdf-btn" type="button" onClick={async () => {
      const filename = `Hour-Coffee-Invoice-${invoiceNo}.pdf`;
      const pdf = await generatePdfBlob(documentId, { filename });
      downloadPdfBlob(pdf, filename);
    }}>
      Download Invoice PDF
    </button> : null}
    </div>
  );
}
