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

function fileLabel(mimeType: string | undefined, fileUrl: string): "PDF" | "Image" | "File" {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.startsWith("image/")) return "Image";
  if (fileUrl.startsWith("data:application/pdf") || fileUrl.toLowerCase().includes(".pdf")) return "PDF";
  if (fileUrl.startsWith("data:image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(fileUrl)) return "Image";
  return "File";
}

function FileActions({ fileUrl, openLabel, downloadLabel, fileName }: { fileUrl: string; openLabel: string; downloadLabel: string; fileName?: string }) {
  return (
    <div className="admin-file-actions">
      <a className="admin-file-link" href={fileUrl} target="_blank" rel="noopener noreferrer">
        {openLabel}
      </a>
      <a className="admin-file-link" href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer">
        {downloadLabel}
      </a>
    </div>
  );
}

function ReceiptPreview({ fileUrl, fileName, mimeType }: { fileUrl?: string; fileName?: string; mimeType?: string }) {
  if (!fileUrl) {
    return (
      <section>
        <h3>Receipt</h3>
        <p>No file uploaded.</p>
      </section>
    );
  }

  const label = fileLabel(mimeType, fileUrl);
  return (
    <section>
      <h3>Receipt</h3>
      <p className="admin-file-type">File type: {label}</p>
      <p>{fileName || "Uploaded file"}</p>
      {label === "PDF" ? (
        <FileActions fileUrl={fileUrl} fileName={fileName} openLabel="Open Receipt PDF" downloadLabel="Download Receipt PDF" />
      ) : (
        <>
          <img className="admin-image-preview" src={fileUrl} alt="Payment receipt" />
          <FileActions fileUrl={fileUrl} fileName={fileName} openLabel="Open Receipt Image" downloadLabel="Download Receipt Image" />
        </>
      )}
    </section>
  );
}

function GenericFilePreview({
  title,
  fileUrl,
  fileName,
  mimeType,
  openLabel = "Open File",
  downloadLabel = "Download File"
}: {
  title: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  openLabel?: string;
  downloadLabel?: string;
}) {
  if (!fileUrl) {
    return (
      <section>
        <h3>{title}</h3>
        <p>No file available.</p>
      </section>
    );
  }

  const label = fileLabel(mimeType, fileUrl);
  return (
    <section>
      <h3>{title}</h3>
      <p className="admin-file-type">File type: {label}</p>
      <p>{fileName || "File"}</p>
      {label === "Image" ? <img className="admin-image-preview" src={fileUrl} alt={title} /> : null}
      <FileActions fileUrl={fileUrl} fileName={fileName} openLabel={openLabel} downloadLabel={downloadLabel} />
    </section>
  );
}

function CustomizationPreview({ title, designs, urls, type, keySuffix }: { title: string; designs?: CustomizationByDate; urls?: InvoiceDetails["customizationUrls"]; type: string; keySuffix?: string }) {
  const storedUrls = (urls ?? []).filter((file) => file.type === type && (!keySuffix || file.designKey.endsWith(keySuffix)));
  const entries = Object.entries(designs ?? {}).filter(([key, design]) => design?.dataUrl && (!keySuffix || key.endsWith(keySuffix)));
  return (
    <section>
      <h3>{title}</h3>
      {storedUrls.length ? (
        storedUrls.map((file) => (
          <div className="admin-design-preview" key={`${file.type}-${file.designKey}`}>
            <p className="admin-file-type">File type: {fileLabel(file.mimeType, file.fileUrl)}</p>
            <p>{file.fileName}</p>
            {fileLabel(file.mimeType, file.fileUrl) === "Image" ? <img className="admin-image-preview" src={file.fileUrl} alt={`${title} ${file.designKey}`} /> : null}
            <FileActions fileUrl={file.fileUrl} fileName={file.fileName} openLabel={fileLabel(file.mimeType, file.fileUrl) === "Image" ? "Open Image" : "Open File"} downloadLabel={fileLabel(file.mimeType, file.fileUrl) === "Image" ? "Download Image" : "Download File"} />
          </div>
        ))
      ) : entries.length ? (
        entries.map(([key, design]) =>
          design ? (
            <div className="admin-design-preview" key={key}>
              <p className="admin-file-type">File type: {fileLabel(undefined, design.dataUrl)}</p>
              <p>{design.fileName}</p>
              {fileLabel(undefined, design.dataUrl) === "Image" ? <img className="admin-image-preview" src={design.dataUrl} alt={`${title} ${key}`} /> : null}
              <FileActions fileUrl={design.dataUrl} fileName={design.fileName} openLabel={fileLabel(undefined, design.dataUrl) === "Image" ? "Open Image" : "Open File"} downloadLabel={fileLabel(undefined, design.dataUrl) === "Image" ? "Download Image" : "Download File"} />
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
            <p>Invoice PDF link: {invoice.invoicePdfUrl ? "Available" : "Not generated locally."}</p>
          </section>
          {invoice.invoicePdfUrl ? <GenericFilePreview title="Invoice PDF" fileUrl={invoice.invoicePdfUrl} fileName={`${invoice.invoiceNo}.pdf`} mimeType="application/pdf" openLabel="Open Invoice PDF" downloadLabel="Download Invoice PDF" /> : null}
          <ReceiptPreview fileUrl={invoice.receiptUrl ?? invoice.receiptDataUrl} fileName={invoice.receiptName} mimeType={invoice.receiptMimeType} />
          {(invoice.invoiceFiles ?? []).map((file) => (
            <GenericFilePreview key={file.fileUrl} title="Invoice File" fileUrl={file.fileUrl} fileName={file.fileName} mimeType={file.mimeType} />
          ))}
          <CustomizationPreview title="Cart Design Image" designs={invoice.cartDesigns} urls={invoice.customizationUrls} type="CART_DESIGN" />
          <CustomizationPreview title="Hot Cup Design Image" designs={invoice.stickerDesigns} urls={invoice.customizationUrls} type="CUP_STICKER" keySuffix=":hot" />
          <CustomizationPreview title="Cold Cup Design Image" designs={invoice.stickerDesigns} urls={invoice.customizationUrls} type="CUP_STICKER" keySuffix=":cold" />
          <CustomizationPreview title="Cup Sleeve Design Image" designs={invoice.sleeveDesigns} urls={invoice.customizationUrls} type="CUP_SLEEVE" />
        </div>
      </Card>
    </main>
  );
}
