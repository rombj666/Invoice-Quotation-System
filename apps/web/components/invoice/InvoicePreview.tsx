"use client";

import type { QuotationData } from "../../types/quotation";
import { calculatePricing, getBaristasNeeded } from "../../lib/pricing";
import { formatCompactDate, formatMoney, formatTime } from "../../lib/formatters";

export function InvoicePreview({ invoiceNo, quotation }: { invoiceNo: string; quotation: QuotationData }) {
  const pricing = calculatePricing(quotation);
  const firstDate = quotation.serviceDates[0];
  const drinkNames = [
    ["americano", "Americano"],
    ["latte", "Cafe Latte"],
    ["chocolate", "Dark Chocolate"],
    ["lemonade", "Lemonade"]
  ] as const;

  function drinkLabel(dateId: string, drinkId: (typeof drinkNames)[number][0]) {
    const qty = quotation.drinkOrders[dateId]?.[drinkId] ?? { ice: 0, hot: 0 };
    return drinkId === "lemonade" ? `${qty.ice} ice` : `${qty.ice} / ${qty.hot}`;
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
              <strong>{formatCompactDate(new Date())}</strong>
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
        <ul className="invoice-date-list">
          {quotation.serviceDates.map((date) => (
            <li key={date.id}>
              <strong>{formatCompactDate(date.serviceDate)}</strong>
              <span>{formatTime(date.startTime)} to {formatTime(date.endTime)}</span>
              <span>{date.cups} cups</span>
              <span>{getBaristasNeeded(date)} barista(s)</span>
            </li>
          ))}
        </ul>
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
        {quotation.sameDrinkDistribution ? (
          <div className="ok-summary">Hour Coffee will decide the final drink ratio and distribution for this event.</div>
        ) : (
          <div className="table-scroll">
            <table className="invoice-table compact drink-summary-table">
              <thead><tr><th>Date</th>{drinkNames.map(([id, name]) => <th key={id}>{name}<small>{id === "lemonade" ? "Ice only" : "Ice / Hot"}</small></th>)}</tr></thead>
              <tbody>
                {quotation.serviceDates.map((date) => (
                  <tr key={date.id}><td className="date-cell">{formatCompactDate(date.serviceDate)}</td>{drinkNames.map(([id]) => <td className="number-cell" key={id}>{drinkLabel(date.id, id)}</td>)}</tr>
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
