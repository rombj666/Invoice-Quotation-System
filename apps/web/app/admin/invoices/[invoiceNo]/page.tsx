"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "../../../../components/common/Card";
import { apiBaseUrl } from "../../../../lib/api-client";
import { calculatePricing } from "../../../../lib/invoice-pricing";
import { CART_SELECTION_ERROR, hasCartAddonConflict } from "../../../../lib/addons";
import { loadInvoiceByNo } from "../../../../lib/invoice-storage";
import { formatDateLabel, formatMoney, formatTime } from "../../../../lib/formatters";
import type { CustomizationByDate } from "../../../../types/customization";
import type { InvoiceDetails } from "../../../../types/invoice";
import { getAdminAddonRows } from "../../../../lib/admin-addons";
import { DocumentCard } from "../../../../components/admin/DocumentCard";
import { getProvidedBeverageNames } from "../../../../lib/beverages";

function fileLabel(mimeType: string | undefined, fileUrl: string): "PDF" | "Image" | "File" {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType?.startsWith("image/")) return "Image";
  if (fileUrl.startsWith("data:application/pdf") || fileUrl.toLowerCase().includes(".pdf")) return "PDF";
  if (fileUrl.startsWith("data:image/") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(fileUrl)) return "Image";
  return "File";
}

function FileActions({ fileUrl, openLabel, downloadLabel, fileName }: { fileUrl: string; openLabel: string; downloadLabel: string; fileName?: string }) {
  const downloadUrl = fileUrl.startsWith("http")
    ? `${apiBaseUrl}/api/files/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName || "hour-coffee-file")}`
    : fileUrl;

  return (
    <div className="admin-file-actions">
      <a className="admin-file-link" href={fileUrl} target="_blank" rel="noopener noreferrer">
        {openLabel}
      </a>
      <a className="admin-file-link" href={downloadUrl} download={fileName} target="_blank" rel="noopener noreferrer">
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
  const addonAmount = pricing.addonTotal + pricing.cupStickerFee + pricing.cupSleeveFee;
  const addonRows = getAdminAddonRows(quotation, pricing.cupStickerFee, pricing.cupSleeveFee);

  return (
    <main className="admin-page">
      <Card className="admin-card">
        <div className="admin-detail-header"><div><p className="admin-eyebrow">Invoice</p><h1>{invoice.invoiceNo}</h1></div><div className="admin-actions"><Link href={`/admin/invoices/${invoice.invoiceNo}/edit`}>Edit Invoice</Link></div></div>
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
            <h3>Drink Preferences</h3>
            {quotation.serviceDates.map((date) => <div key={date.id}><strong>{formatDateLabel(date.serviceDate)}</strong><p>Drinks provided: {getProvidedBeverageNames(quotation, date.id).join(", ") || "None"}</p></div>)}
          </section>
          <section>
            <h3>Add-ons</h3>
            {addonRows.map((addon) => (
              <p key={addon.name}>
                {addon.name}: {addon.price > 0 ? formatMoney(addon.price) : "FREE"}
              </p>
            ))}
            {!addonRows.length ? <p>No add-ons selected.</p> : null}
            {hasCartAddonConflict(quotation.selectedAddons) ? <div className="warn-summary">{CART_SELECTION_ERROR}</div> : null}
          </section>
          <section>
            <h3>Final Total</h3>
            <p>Base: {formatMoney(pricing.baseAmount)}</p>
            {pricing.extraBaristaFee > 0 ? <p>Extra barista fee: {formatMoney(pricing.extraBaristaFee)}</p> : null}
            {pricing.extraServingHoursByDate.filter((entry) => entry.fee > 0).map((entry) => <p key={entry.serviceDateId}>Extra Serving Hour — {formatDateLabel(entry.date)}: {entry.cups} cups served for {entry.exactServiceHours} hours; {entry.extraServingHours} additional hour(s) × RM{entry.rate} = {formatMoney(entry.fee)}</p>)}
            {pricing.machineRentalFee > 0 ? <p>Machine rental: {formatMoney(pricing.machineRentalFee)}</p> : null}
            {addonAmount > 0 ? <p>Add-ons: {formatMoney(addonAmount)}</p> : null}
            <p>Subtotal: {formatMoney(pricing.subtotal)}</p>
            {pricing.discountAmount > 0 ? <p>Discount: {formatMoney(pricing.discountAmount)}</p> : null}
            <p>Total: {formatMoney(pricing.total)}</p>
          </section>
          <DocumentCard documentLabel="Invoice PDF" fileUrl={invoice.invoicePdfUrl} fileName={`${invoice.invoiceNo}.pdf`} />
          {invoice.internalNotes?.length ? <section><h3>Internal Notes</h3>{invoice.internalNotes.map((note,index)=><p key={`${note.createdAt}-${index}`}>{note.note}<br /><small>{note.createdBy} · {new Date(note.createdAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}</small></p>)}</section> : null}
          {invoice.editHistory?.length ? <section><h3>Edit History</h3>{invoice.editHistory.map((entry,index)=><p key={`${entry.changedAt}-${index}`}><strong>{new Date(entry.changedAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}</strong><br />{entry.summary || "Updated"} · {entry.changedBy}</p>)}</section> : null}
          <ReceiptPreview fileUrl={invoice.receiptUrl ?? invoice.receiptDataUrl} fileName={invoice.receiptName} mimeType={invoice.receiptMimeType} />
          {invoice.customMenuFile?.fileUrl ? (
            <GenericFilePreview title="Custom Menu File" fileUrl={invoice.customMenuFile.fileUrl} fileName={invoice.customMenuFile.fileName} mimeType={invoice.customMenuFile.mimeType} />
          ) : null}
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
