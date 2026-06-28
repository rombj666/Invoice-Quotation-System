"use client";

import type { QuotationData } from "../../types/quotation";
import { calculatePricing, getBaristasNeeded } from "../../lib/pricing";
import { formatDateLabel, formatMoney, formatTime } from "../../lib/formatters";

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
    return `Ice ${qty.ice}${drinkId === "lemonade" ? "" : `, Hot ${qty.hot}`}`;
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
              <strong>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong>
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
        <div className="summary-rows">
          <div><strong>Dates</strong><span>{quotation.serviceDates.map((date) => formatDateLabel(date.serviceDate)).join(", ")}</span></div>
          <div><strong>Time</strong><span>{firstDate ? `${formatTime(firstDate.startTime)} to ${formatTime(firstDate.endTime)}` : "-"}</span></div>
          <div><strong>Total cups</strong><span>{pricing.totalCups}</span></div>
          <div><strong>Cups per date</strong><span>{quotation.serviceDates.map((date) => `${date.cups} on ${formatDateLabel(date.serviceDate)}`).join(", ")}</span></div>
          <div><strong>Barista(s)</strong><span>{firstDate ? getBaristasNeeded(firstDate) : "-"}</span></div>
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Item</th>
            <th>Description</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Coffee Catering</td>
            <td>
              Americano, Cafe Latte, Dark Chocolate, Lemonade
            </td>
            <td>1</td>
            <td>{formatMoney(pricing.baseAmount)}</td>
            <td>{formatMoney(pricing.baseAmount)}</td>
          </tr>
          {pricing.setupFee > 0 ? (
            <tr>
              <td></td>
              <td>Setup Fee</td>
              <td>Small order setup fee</td>
              <td>1</td>
              <td>{formatMoney(pricing.setupFee)}</td>
              <td>{formatMoney(pricing.setupFee)}</td>
            </tr>
          ) : null}
          {pricing.extraBaristaFee > 0 ? (
            <tr>
              <td></td>
              <td>Additional Barista Fee</td>
              <td>Extra barista(s) required</td>
              <td>1</td>
              <td>{formatMoney(pricing.extraBaristaFee)}</td>
              <td>{formatMoney(pricing.extraBaristaFee)}</td>
            </tr>
          ) : null}
          {pricing.machineRentalFee > 0 ? (
            <tr>
              <td></td>
              <td>Machine Rental</td>
              <td>Additional coffee machine rental</td>
              <td>1</td>
              <td>{formatMoney(pricing.machineRentalFee)}</td>
              <td>{formatMoney(pricing.machineRentalFee)}</td>
            </tr>
          ) : null}
          {pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee > 0 ? (
            <tr>
              <td></td>
              <td>
                Add-ons
              </td>
              <td>{[...quotation.selectedAddons.map((addon) => addon.name), quotation.hasCupSleeves ? "Custom Cup Sleeves" : "", quotation.hasCupStickers ? "Custom Cup Stickers" : ""].filter(Boolean).join(", ")}</td>
              <td>1</td>
              <td>{formatMoney(pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee)}</td>
              <td>{formatMoney(pricing.addonTotal + pricing.cupSleeveFee + pricing.cupStickerFee)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="invoice-section">
        <h3>Drink Breakdown</h3>
        <div className="table-scroll">
          <table className="invoice-table compact">
            <thead><tr><th>Date</th>{drinkNames.map(([, name]) => <th key={name}>{name}</th>)}</tr></thead>
            <tbody>
              {quotation.serviceDates.map((date) => (
                <tr key={date.id}><td>{formatDateLabel(date.serviceDate)}</td>{drinkNames.map(([id]) => <td key={id}>{drinkLabel(date.id, id)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="invoice-section">
        <h3>Acknowledgements</h3>
        <div className="ack-summary">
          <div>Access 75 to 120 minutes before service.</div>
          <div>Service space 5 ft by 5 ft per cart.</div>
          <div>One dedicated 13A 240V socket within 10 ft.</div>
          <div>Wheelchair accessible service location.</div>
          <div>No refund for unredeemed drinks.</div>
        </div>
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
