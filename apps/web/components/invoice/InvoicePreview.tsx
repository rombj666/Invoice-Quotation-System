"use client";

import type { QuotationData } from "../../types/quotation";
import type { InvoiceDetails } from "../../types/invoice";
import { calculatePricing, getBaristasNeeded } from "../../lib/invoice-pricing";
import { getAddonDisplayName } from "../../lib/addons";
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
  const pricing = calculatePricing(quotation);
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
          <p>{quotation.customer.name}</p>
          <p>{quotation.customer.phone}</p>
          <p>{quotation.customer.email}</p>
        </div>
      </div>

      {invoice ? (
        <div className="invoice-section">
          <h3>Event & Payment Details</h3>
          <div className="invoice-summary-grid">
            <div><span>Event address</span><strong>{invoice.eventAddress || quotation.fullAddress || quotation.location}</strong></div>
            <div><span>Dress code</span><strong>{invoice.dressCode === "Custom" ? invoice.customDressCode : invoice.dressCode || "-"}</strong></div>
            <div><span>Environment</span><strong>{invoice.environment || "-"}</strong></div>
            <div><span>Invoice status</span><strong>{(invoice.invoiceStatus ?? "SUBMITTED").replaceAll("_", " ")}</strong></div>
            <div><span>Payment status</span><strong>{(invoice.paymentStatus ?? "UNPAID").replaceAll("_", " ")}</strong></div>
          </div>
          {invoice.environmentNotes ? <p>{invoice.environmentNotes}</p> : null}
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
            <td>Coffee Catering</td>
            <td>
              {beverageNames || "Beverages saved with quotation"}
            </td>
            <td className="number-cell">1</td>
            <td className="amount-cell">{formatMoney(pricing.baseAmount)}</td>
            <td className="amount-cell">{formatMoney(pricing.baseAmount)}</td>
          </tr>
          {pricing.extraBaristaFee > 0 ? (
            <tr>
              <td>Additional Barista Fee</td>
              <td>Extra barista(s) required</td>
              <td className="number-cell">1</td>
              <td className="amount-cell">{formatMoney(pricing.extraBaristaFee)}</td>
              <td className="amount-cell">{formatMoney(pricing.extraBaristaFee)}</td>
            </tr>
          ) : null}
          {pricing.extraServingHoursByDate.filter((entry) => entry.fee > 0).map((entry) => <tr key={`extra-hours-${entry.serviceDateId}`}><td>Extra Serving Hour</td><td>{formatCompactDate(entry.date)} · {entry.cups} cups served for {entry.exactServiceHours} hours · {entry.extraServingHours} additional hour(s) × RM{entry.rate}</td><td className="number-cell">{entry.extraServingHours}</td><td className="amount-cell">{formatMoney(entry.rate)}</td><td className="amount-cell">{formatMoney(entry.fee)}</td></tr>)}
          {pricing.machineRentalFee > 0 ? (
            <tr>
              <td>Machine Rental</td>
              <td>Additional coffee machine rental</td>
              <td className="number-cell">1</td>
              <td className="amount-cell">{formatMoney(pricing.machineRentalFee)}</td>
              <td className="amount-cell">{formatMoney(pricing.machineRentalFee)}</td>
            </tr>
          ) : null}
          {pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee > 0 ? (
            <tr>
              <td>
                Add-ons
              </td>
              <td>{[...quotation.selectedAddons.map((addon) => getAddonDisplayName(addon.name)), quotation.hasCupSleeves ? "Custom Cup Sleeves" : "", quotation.hasCupStickers ? "Custom Cup Stickers" : ""].filter(Boolean).join(", ")}</td>
              <td className="number-cell">1</td>
              <td className="amount-cell">{formatMoney(pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee)}</td>
              <td className="amount-cell">{formatMoney(pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

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
