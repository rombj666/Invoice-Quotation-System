"use client";

import type { QuotationData } from "../../types/quotation";
import type { InvoiceDetails } from "../../types/invoice";
import { calculatePricing, getBaristasNeeded } from "../../lib/pricing";
import { formatCompactDate, formatMoney, formatTime } from "../../lib/formatters";

export function InvoicePreview({ invoiceNo, quotation, invoice }: { invoiceNo: string; quotation: QuotationData; invoice?: InvoiceDetails }) {
  const pricing = calculatePricing(quotation);
  const firstDate = quotation.serviceDates[0];
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
    const qty = quotation.drinkOrders[dateId]?.[drinkId] ?? { ice: 0, hot: 0 };
    return qty[type];
  }

  return (
    <div className="invoice-preview-wrap">
    <div className="invoice-card" id="invoicePreview">
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
              Americano, Cafe Latte, Dark Chocolate, Lemonade
            </td>
            <td className="number-cell">1</td>
            <td className="amount-cell">{formatMoney(pricing.baseAmount)}</td>
            <td className="amount-cell">{formatMoney(pricing.baseAmount)}</td>
          </tr>
          {pricing.setupFee > 0 ? (
            <tr>
              <td>Setup Fee</td>
              <td>Small order setup fee</td>
              <td className="number-cell">1</td>
              <td className="amount-cell">{formatMoney(pricing.setupFee)}</td>
              <td className="amount-cell">{formatMoney(pricing.setupFee)}</td>
            </tr>
          ) : null}
          {pricing.extraBaristaFee > 0 ? (
            <tr>
              <td>Additional Barista Fee</td>
              <td>Extra barista(s) required</td>
              <td className="number-cell">1</td>
              <td className="amount-cell">{formatMoney(pricing.extraBaristaFee)}</td>
              <td className="amount-cell">{formatMoney(pricing.extraBaristaFee)}</td>
            </tr>
          ) : null}
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
              <td>{[...quotation.selectedAddons.map((addon) => addon.name), quotation.hasCupSleeves ? "Custom Cup Sleeves" : "", quotation.hasCupStickers ? "Custom Cup Stickers" : ""].filter(Boolean).join(", ")}</td>
              <td className="number-cell">1</td>
              <td className="amount-cell">{formatMoney(pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee)}</td>
              <td className="amount-cell">{formatMoney(pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="invoice-section">
        <h3>Drink Breakdown</h3>
        {quotation.letHourCoffeeDecideDrinks ? (
          <div className="ok-summary">Hour Coffee will decide the final drink ratio and distribution for this event.</div>
        ) : (
          <div className="table-scroll">
            <table className="invoice-table compact drink-summary-table">
              <thead><tr><th>Date</th>{drinkColumns.map(([id, type, label]) => <th key={`${id}-${type}`}>{label}</th>)}</tr></thead>
              <tbody>
                {quotation.serviceDates.map((date) => (
                  <tr key={date.id}><td className="date-cell">{formatCompactDate(date.serviceDate)}</td>{drinkColumns.map(([id, type]) => <td className="number-cell" key={`${id}-${type}`}>{drinkQuantity(date.id, id, type)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="invoice-totals">
        <div>
          <span>Subtotal</span>
          <strong>{formatMoney(pricing.subtotal)}</strong>
        </div>
        <div>
          <span>Discount</span>
          <strong>{formatMoney(pricing.discountAmount)}</strong>
        </div>
        <div>
          <span>Roundoff</span>
          <strong>MYR 0.00</strong>
        </div>
        <div className="final">
          <span>Total MYR</span>
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
    <button className="pdf-btn" type="button" onClick={() => window.print()}>
      Download Invoice PDF
    </button>
    </div>
  );
}
