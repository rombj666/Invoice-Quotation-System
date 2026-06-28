"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "../../../../components/common/Card";
import { calculatePricing } from "../../../../lib/pricing";
import { loadInvoiceByNo } from "../../../../lib/invoice-storage";
import { formatDateLabel, formatMoney, formatTime } from "../../../../lib/formatters";
import type { CustomizationByDate } from "../../../../types/customization";
import type { InvoiceDetails } from "../../../../types/invoice";

function FilePreview({ title, fileUrl, fileName }: { title: string; fileUrl?: string; fileName?: string }) {
  if (!fileUrl) {
    return (
      <section>
        <h3>{title}</h3>
        <p>No file uploaded.</p>
      </section>
    );
  }

  const isPdf = fileUrl.startsWith("data:application/pdf") || fileUrl.toLowerCase().includes(".pdf");
  return (
    <section>
      <h3>{title}</h3>
      <p>{fileName || "Uploaded file"}</p>
      {isPdf ? (
        <a className="admin-file-link" href={fileUrl} target="_blank" rel="noreferrer">
          Open PDF
        </a>
      ) : (
        <img className="admin-image-preview" src={fileUrl} alt={title} />
      )}
    </section>
  );
}

function CustomizationPreview({ title, designs, urls, type }: { title: string; designs?: CustomizationByDate; urls?: InvoiceDetails["customizationUrls"]; type: string }) {
  const storedUrls = (urls ?? []).filter((file) => file.type === type);
  const entries = Object.entries(designs ?? {}).filter(([, design]) => design?.dataUrl);
  return (
    <section>
      <h3>{title}</h3>
      {storedUrls.length ? (
        storedUrls.map((file) => (
          <div className="admin-design-preview" key={`${file.type}-${file.designKey}`}>
            <p>{file.fileName}</p>
            <img className="admin-image-preview" src={file.fileUrl} alt={`${title} ${file.designKey}`} />
          </div>
        ))
      ) : entries.length ? (
        entries.map(([key, design]) =>
          design ? (
            <div className="admin-design-preview" key={key}>
              <p>{design.fileName}</p>
              <img className="admin-image-preview" src={design.dataUrl} alt={`${title} ${key}`} />
            </div>
          ) : null
        )
      ) : (
        <p>No design uploaded.</p>
      )}
    </section>
  );
}

export default function AdminInvoiceDetailPage() {
  const params = useParams<{ invoiceNo: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);

  useEffect(() => {
    loadInvoiceByNo(params.invoiceNo).then(setInvoice);
  }, [params.invoiceNo]);

  if (!invoice) {
    return (
      <main className="hc-page admin-page">
        <Card>
          <h1>Invoice not found</h1>
          <Link className="hc-button hc-button-secondary" href="/admin/invoices">
            Back to Invoice List
          </Link>
        </Card>
      </main>
    );
  }

  const quotation = invoice.quotation;
  const pricing = calculatePricing(quotation);

  return (
    <main className="hc-page admin-page">
      <Card className="admin-card">
        <div className="admin-nav">
          <Link href="/admin">Admin Home</Link>
          <Link href="/admin/quotations">Quotation List</Link>
          <Link href="/admin/invoices">Invoice List</Link>
        </div>
        <h1>{invoice.invoiceNo}</h1>
        <div className="detail-grid">
          <section>
            <h3>Invoice</h3>
            <p>Invoice No.: {invoice.invoiceNo}</p>
            <p>Linked Quotation No.: {quotation.quotationNo}</p>
            <p>Invoice status: {invoice.invoiceStatus ?? "SUBMITTED"}</p>
            <p>Payment status: {invoice.paymentStatus ?? "RECEIPT_UPLOADED"}</p>
          </section>
          <section>
            <h3>Customer Info</h3>
            <p>{quotation.customer.name}</p>
            <p>{quotation.customer.phone}</p>
            <p>{quotation.customer.email}</p>
            <p>{quotation.customer.companyName || "-"}</p>
            <p>{quotation.customer.billingAddress}</p>
          </section>
          <section>
            <h3>Event Details</h3>
            <p>Event address: {invoice.eventAddress}</p>
            <p>Dress code: {invoice.dressCode === "Custom" ? invoice.customDressCode : invoice.dressCode}</p>
            <p>Environment: {invoice.environment}</p>
            <p>Environment notes: {invoice.environmentNotes || "-"}</p>
          </section>
          <section>
            <h3>Service Dates</h3>
            {quotation.serviceDates.map((date) => (
              <p key={date.id}>
                {formatDateLabel(date.serviceDate)} - {date.cups} cups - {formatTime(date.startTime)} to {formatTime(date.endTime)}
              </p>
            ))}
          </section>
          <section>
            <h3>Drink Distribution</h3>
            {quotation.serviceDates.map((date) => (
              <div key={date.id}>
                <strong>{formatDateLabel(date.serviceDate)}</strong>
                {Object.entries(quotation.drinkOrders[date.id] ?? {}).map(([drink, qty]) => (
                  <p key={drink}>
                    {drink}: ice {qty.ice}, hot {qty.hot}
                  </p>
                ))}
              </div>
            ))}
          </section>
          <section>
            <h3>Add-ons</h3>
            {quotation.selectedAddons.map((addon) => (
              <p key={addon.name}>
                {addon.name}: {formatMoney(addon.price)}
              </p>
            ))}
            {quotation.hasCupStickers ? <p>Custom Cup Stickers</p> : null}
            {quotation.hasCupSleeves ? <p>Custom Cup Sleeves</p> : null}
          </section>
          <section>
            <h3>Customization Options</h3>
            <p>Cart: {quotation.customizationOptions?.cart.mode ?? "same"} / {quotation.customizationOptions?.cart.designCount ?? 1} design(s)</p>
            <p>Sticker: {quotation.customizationOptions?.sticker.mode ?? "same"} / {quotation.customizationOptions?.sticker.designCount ?? 1} design(s)</p>
            <p>Sleeve: {quotation.customizationOptions?.sleeve.mode ?? "same"} / {quotation.customizationOptions?.sleeve.designCount ?? 1} design(s)</p>
          </section>
          <section>
            <h3>Final Total</h3>
            <p>{formatMoney(pricing.total)}</p>
            <p>Invoice PDF link: Not generated locally.</p>
          </section>
          <FilePreview title="Payment Receipt" fileUrl={invoice.receiptUrl ?? invoice.receiptDataUrl} fileName={invoice.receiptName} />
          <CustomizationPreview title="Cart Design Image Preview" designs={invoice.cartDesigns} urls={invoice.customizationUrls} type="CART_DESIGN" />
          <CustomizationPreview title="Cup Sticker Image Preview" designs={invoice.stickerDesigns} urls={invoice.customizationUrls} type="CUP_STICKER" />
          <CustomizationPreview title="Cup Sleeve Image Preview" designs={invoice.sleeveDesigns} urls={invoice.customizationUrls} type="CUP_SLEEVE" />
        </div>
      </Card>
    </main>
  );
}
