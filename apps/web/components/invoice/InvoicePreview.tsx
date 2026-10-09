"use client";

import type { QuotationData } from "../../types/quotation";
import type { InvoiceDetails } from "../../types/invoice";
import { calculateQuotationPricing } from "../../lib/pricing";
import { formatCompactDate, formatMoney, formatTime } from "../../lib/formatters";
import { downloadPdfBlob, generatePdfBlob } from "../../lib/pdf-document";
import presentation from "../common/PdfPresentation.module.css";
import pdfDocument from "../common/PdfDocument.module.css";

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
  const selectedFeatures = [...(quotation.packageSnapshot?.perks.map((perk) => perk.name) ?? []), ...quotation.selectedAddons.map((addon) => addon.name)];
  const features = [...new Map([
    ...selectedFeatures,
    quotation.hasCupSleeves && !selectedFeatures.some((name) => /cup[ -]?sleeve/i.test(name)) ? "Custom Cup Sleeves" : "",
    quotation.hasCupStickers && !selectedFeatures.some((name) => /cup[ -]?sticker/i.test(name)) ? "Custom Cup Stickers" : ""
  ].map((name) => name.trim()).filter(Boolean).map((name) => [name.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " "), name])).values()];
  const savedInvoice = invoice as (InvoiceDetails & { pricingSnapshot?: { total: number } }) | undefined;
  // Stored invoices display their confirmed total; unsaved previews use the existing engine.
  const total = savedInvoice?.createdAt
    ? savedInvoice.pricingSnapshot?.total ?? savedInvoice.quotation.pricingSnapshot?.total ?? pricing.total
    : pricing.total;
  const baristas = (date: QuotationData["serviceDates"][number]) => pricing.perDate.find((entry) => entry.date === date.serviceDate)?.requiredBaristas ?? 0;

  return (
    <div className="invoice-preview-wrap">
    <div className={`invoice-card ${pdfDocument.document}`} id={documentId}>
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

      <div className="invoice-section">
        <h3>Event / Order</h3>
        <div className="invoice-summary-grid">
          <div><span>Event Address</span><strong>{invoice?.eventAddress || quotation.fullAddress || quotation.location || "-"}</strong></div>
          <div><span>Total Cups</span><strong>{pricing.totalCups}</strong></div>
          <div><span>Selected Package</span><strong>{quotation.packageSnapshot?.name || "Coffee Catering"}</strong></div>
        </div>
      </div>

      <div className="invoice-section">
        <h3>Service Dates</h3>
        <div className="table-scroll">
          <table className="invoice-table compact invoice-service-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Start Time – End Time</th>
                <th>Total Baristas</th>
              </tr>
            </thead>
            <tbody>
              {quotation.serviceDates.map((date) => (
                <tr key={date.id}>
                  <td className="date-cell">{formatCompactDate(date.serviceDate)}</td>
                  <td>{formatTime(date.startTime)} – {formatTime(date.endTime)}</td>
                  <td className="number-cell">{baristas(date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {features.length ? <div className="invoice-section"><h3>WHAT’S INCLUDED</h3><ul className={presentation.inclusions}>{features.map((name) => <li key={name}>{name}</li>)}</ul></div> : null}

      <div className="invoice-bank">
        <strong>Bank Details</strong>
        <p>Account Name: HOUR COFFEE</p>
        <p>Account Number: 3242195227</p>
        <p>Bank: PUBLIC BANK BERHAD</p>
      </div>
      <div className={presentation.total}><span>TOTAL</span><strong>{formatMoney(total)}</strong></div>
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
