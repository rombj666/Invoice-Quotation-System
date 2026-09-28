"use client";

import { customizationPhysicalSize, physicalSizeLabels } from "../../../../lib/customization-physical-size";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminSectionEditor } from "../../../../components/admin/AdminSectionEditor";
import { CustomizationLinkModal } from "../../../../components/admin/CustomizationLinkModal";
import { Card } from "../../../../components/common/Card";
import { apiBaseUrl } from "../../../../lib/api-client";
import { calculatePricing } from "../../../../lib/invoice-pricing";
import { CART_SELECTION_ERROR, hasCartAddonConflict } from "../../../../lib/addons";
import { loadInvoiceByNo } from "../../../../lib/invoice-storage";
import { formatDateLabel, formatMoney, formatTime } from "../../../../lib/formatters";
import type { CustomizationByDate } from "../../../../types/customization";
import type { InvoiceDetails } from "../../../../types/invoice";
import { getAdminAddonRows } from "../../../../lib/admin-addons";
import { getCustomerCustomizationSteps } from "../../../../lib/customization-flow";
import { getCustomerPortalToken } from "../../../../lib/admin-api";

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

function GenericFilePreview({
  title,
  fileUrl,
  fileName,
  mimeType,
  openLabel = "Open File",
  downloadLabel = "Download File",
  physicalSize,
  artworkKind
}: {
  title: string;
  fileUrl?: string;
  fileName?: string;
  mimeType?: string;
  openLabel?: string;
  downloadLabel?: string;
  physicalSize?: unknown;
  artworkKind?: string;
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
      {artworkKind ? physicalSizeLabels(physicalSize, customizationPhysicalSize(artworkKind)).map((label) => <p key={label}>{label}</p>) : null}
      {label === "Image" ? <img className="admin-image-preview" src={fileUrl} alt={title} /> : null}
      <FileActions fileUrl={fileUrl} fileName={fileName} openLabel={openLabel} downloadLabel={downloadLabel} />
    </section>
  );
}

function CustomizationPreview({ title, designs, urls, type, keySuffix }: { title: string; designs?: CustomizationByDate; urls?: InvoiceDetails["customizationUrls"]; type: string; keySuffix?: string }) {
  const storedUrls = (urls ?? []).filter((file) => file.type === type && (!keySuffix || file.designKey.replace(/:\d+$/, "").endsWith(keySuffix)));
  const entries = Object.entries(designs ?? {}).filter(([key, design]) => design?.dataUrl && (!keySuffix || key.endsWith(keySuffix)));
  return (
    <section>
      <h3>{title}</h3>
      {storedUrls.length ? (
        storedUrls.map((file) => (
          <div className="admin-design-preview" key={`${file.type}-${file.designKey}`}>
            <p className="admin-file-type">File type: {fileLabel(file.mimeType, file.fileUrl)}</p>
            <p>{file.fileName}</p>
            {physicalSizeLabels(file.metadata && typeof file.metadata === "object" && "physicalSize" in file.metadata ? file.metadata.physicalSize : undefined, customizationPhysicalSize(file.type, file.designKey)).map((label) => <p key={label}>{label}</p>)}
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
              {physicalSizeLabels(design, customizationPhysicalSize(type, key)).map((label) => <p key={label}>{label}</p>)}
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
  const [activeSection, setActiveSection] = useState("summary");
  const params = useParams<{ invoiceNo: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [portalLink, setPortalLink] = useState("");
  const [actionError, setActionError] = useState("");

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

  const currentInvoice = invoice;
  const quotation = currentInvoice.quotation;
  const pricing = calculatePricing(quotation);
  const savedPricing = (invoice as InvoiceDetails & { pricingSnapshot?: { subtotal: number; discountAmount: number; total: number } }).pricingSnapshot ?? quotation.pricingSnapshot;
  const customizationSteps = getCustomerCustomizationSteps(quotation);
  const addonRows = getAdminAddonRows(quotation, pricing.cupStickerFee, pricing.cupSleeveFee);

  async function loadPortalLink() {
    setActionError("");
    try { const result = await getCustomerPortalToken(quotation.quotationNo); setPortalLink(`${window.location.origin}/portal/${result.token}`); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "Unable to open customer portal."); }
  }

  return <main className="admin-page"><Card className="admin-card">
    <AdminSectionEditor title={invoice.invoiceNo} backHref="/admin/invoices" activeSection={activeSection} onSectionChange={setActiveSection}
      actions={<><button type="button" aria-pressed={activeSection === "summary"} onClick={() => setActiveSection("summary")}>Summary</button>
<Link href={`/admin/invoices/${invoice.invoiceNo}/edit`}>Edit Invoice</Link>
<button type="button" onClick={loadPortalLink}>Customization Link</button>
</>}
      sections={[
        { id: "summary", label: "Summary", content: <><section><h2>Summary</h2><dl className="admin-summary-grid"><div><dt>Customer Name</dt><dd>{quotation.customer.name}</dd></div><div><dt>Phone</dt><dd>{quotation.customer.phone}</dd></div><div><dt>Email</dt><dd>{quotation.customer.email}</dd></div><div><dt>Total Cups</dt><dd>{pricing.totalCups}</dd></div><div><dt>Event Address</dt><dd>{invoice.eventAddress}</dd></div><div><dt>Event Date(s)</dt><dd>{quotation.serviceDates.map((date) => formatDateLabel(date.serviceDate)).join(", ")}</dd></div><div><dt>Payment Receipt</dt><dd>{invoice.receiptUrl || invoice.receiptDataUrl ? <FileActions fileUrl={(invoice.receiptUrl || invoice.receiptDataUrl)!} fileName={invoice.receiptName} openLabel="View" downloadLabel="Download" /> : "-"}</dd></div></dl></section></> },
        { id: "customer", label: "Customer & Reference", content: <><section>
            <h3>Invoice</h3>
            <p>Invoice No.: {invoice.invoiceNo}</p>
            <p>Linked Quotation No.: {quotation.quotationNo}</p>
            <p>Invoice status: {invoice.invoiceStatus ?? "SUBMITTED"}</p>
            <p>Payment status: {invoice.paymentStatus ?? "RECEIPT_UPLOADED"}</p>
          </section><section>
            <h3>Customer Info</h3>
            <p>{quotation.customer.name}</p>
            <p>{quotation.customer.phone}</p>
            <p>{quotation.customer.email}</p>
            <p>{quotation.customer.companyName || "-"}</p>
            <p>{quotation.customer.billingAddress}</p>
          </section></> },
        { id: "event", label: "Event & Service Dates", content: <><section>
            <h3>Event Details</h3>
            <p>Event address: {invoice.eventAddress}</p>
            <p>Dress code: {invoice.dressCode === "Custom" ? invoice.customDressCode : invoice.dressCode}</p>
            <p>Environment: {invoice.environment}</p>
            <p>Environment notes: {invoice.environmentNotes || "-"}</p>
          {invoice.customizationSubmission?.eventAddress ? <p>Setup address: {invoice.customizationSubmission.eventAddress}</p> : null}</section><section>
            <h3>Service Dates</h3>
            {quotation.serviceDates.map((date) => (
              <p key={date.id}>
                {formatDateLabel(date.serviceDate)} - {date.cups} cups - {formatTime(date.startTime)} to {formatTime(date.endTime)}
              </p>
            ))}
          </section></> },
        { id: "addons", label: "Add-ons", content: <><section>
            <h3>Add-ons</h3>
            {addonRows.map((addon) => (
              <p key={addon.name}>
                {addon.name}: {addon.price > 0 ? formatMoney(addon.price) : "FREE"}
              </p>
            ))}
            {!addonRows.length ? <p>No add-ons selected.</p> : null}
            {hasCartAddonConflict(quotation.selectedAddons) ? <div className="warn-summary">{CART_SELECTION_ERROR}</div> : null}
          </section></> },
        { id: "review", label: "Review & Documents", content: <><section>
            <h2>Price Breakdown</h2>
            <p>Base / {pricing.totalCups} cups: {formatMoney(pricing.baseAmount)}</p>
            {pricing.extraBaristaFee > 0 ? <p>Extra barista fee: {formatMoney(pricing.extraBaristaFee)}</p> : null}
            {pricing.extraServingHoursByDate.filter((entry) => entry.fee > 0).map((entry) => <p key={entry.serviceDateId}>Extra Serving Hour — {formatDateLabel(entry.date)}: {entry.cups} cups served for {entry.exactServiceHours} hours; {entry.extraServingHours} additional hour(s) × RM{entry.rate} = {formatMoney(entry.fee)}</p>)}
            {pricing.machineRentalFee > 0 ? <p>Machine rental: {formatMoney(pricing.machineRentalFee)}</p> : null}
            <h3>Add-ons</h3>{addonRows.length ? addonRows.map((addon) => <p key={addon.name}>{addon.name}: {addon.price > 0 ? formatMoney(addon.price) : "Included"}</p>) : <p>-</p>}
<h3>Extra Charges</h3>{(quotation.extraCharges ?? []).map((charge) => <p key={charge.id}>{charge.title}: {formatMoney(charge.amount)}</p>)}{!quotation.extraCharges?.length ? <p>-</p> : null}

            {(savedPricing?.discountAmount ?? pricing.discountAmount) > 0 ? <p>Discount: {formatMoney(savedPricing?.discountAmount ?? pricing.discountAmount)}</p> : null}
            <p>Total: {formatMoney(savedPricing?.total ?? pricing.total)}</p>
          </section><section><h2>Documents</h2><h3>Invoice PDF</h3>{invoice.invoicePdfUrl ? <FileActions fileUrl={invoice.invoicePdfUrl} fileName={`${invoice.invoiceNo}.pdf`} openLabel="View" downloadLabel="Download" /> : <p>-</p>}<h3>Payment Receipt</h3>{invoice.receiptUrl || invoice.receiptDataUrl ? <FileActions fileUrl={(invoice.receiptUrl || invoice.receiptDataUrl)!} fileName={invoice.receiptName} openLabel="View" downloadLabel="Download" /> : <p>-</p>}</section>
{invoice.customMenuFile?.fileUrl ? (
            <GenericFilePreview title="Custom Menu File" artworkKind="customMenu" fileUrl={invoice.customMenuFile.fileUrl} fileName={invoice.customMenuFile.fileName} mimeType={invoice.customMenuFile.mimeType} />
          ) : null}
{(invoice.invoiceFiles ?? []).map((file) => (
            <GenericFilePreview key={file.fileUrl} title={file.metadata?.kind === "customMenu" ? "Custom Menu Artwork" : "Invoice File"} artworkKind={file.metadata?.kind} physicalSize={file.metadata?.physicalSize} fileUrl={file.fileUrl} fileName={file.fileName} mimeType={file.mimeType} />
          ))}</> },
        { id: "notes", label: "Notes & History", content: <>{invoice.internalNotes?.length ? <section><h3>Internal Notes</h3>{invoice.internalNotes.map((note,index)=><p key={`${note.createdAt}-${index}`}>{note.note}<br /><small>{note.createdBy} · {new Date(note.createdAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}</small></p>)}</section> : null}
{invoice.editHistory?.length ? <section><h3>Edit History</h3>{invoice.editHistory.map((entry,index)=><p key={`${entry.changedAt}-${index}`}><strong>{new Date(entry.changedAt).toLocaleString("en-MY",{timeZone:"Asia/Kuala_Lumpur"})}</strong><br />{entry.summary || "Updated"} · {entry.changedBy}</p>)}</section> : null}{invoice.customizationSubmission?.submittedAt ? <section><h3>Customization submitted</h3><p>{new Date(invoice.customizationSubmission.submittedAt).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}</p></section> : null}</> },
        ...((customizationSteps.includes("cart") || Object.keys(invoice.cartDesigns ?? {}).length > 0 || invoice.customizationUrls?.some((file) => file.type === "CART_DESIGN")) ? [{ id: "cart", label: "Cart Artwork", content: <><CustomizationPreview title="Cart Design Image" designs={invoice.cartDesigns} urls={invoice.customizationUrls} type="CART_DESIGN" /></> }] : []),
        ...((customizationSteps.includes("sticker") || Object.keys(invoice.stickerDesigns ?? {}).length > 0 || invoice.customizationUrls?.some((file) => file.type === "CUP_STICKER" && file.designKey !== "latte-art")) ? [{ id: "stickers", label: "Cup Artwork", content: <><CustomizationPreview title="Hot Cup Design Image" designs={invoice.stickerDesigns} urls={invoice.customizationUrls} type="CUP_STICKER" keySuffix=":hot" />
<CustomizationPreview title="Cold Cup Design Image" designs={invoice.stickerDesigns} urls={invoice.customizationUrls} type="CUP_STICKER" keySuffix=":cold" /></> }] : []),
        ...((customizationSteps.includes("sleeve") || Object.keys(invoice.sleeveDesigns ?? {}).length > 0 || invoice.customizationUrls?.some((file) => file.type === "CUP_SLEEVE")) ? [{ id: "sleeves", label: "Sleeve Artwork", content: <><CustomizationPreview title="Cup Sleeve Design Image" designs={invoice.sleeveDesigns} urls={invoice.customizationUrls} type="CUP_SLEEVE" /></> }] : []),
        ...((customizationSteps.includes("latte") || invoice.customizationUrls?.some((file) => file.designKey === "latte-art")) ? [{ id: "latte", label: "Latte Artwork", content: <><CustomizationPreview title="Latte Art / Print Pen Artwork · 8 cm print area" urls={invoice.customizationUrls} type="CUP_STICKER" keySuffix="latte-art" /></> }] : []),
      ]}
    >
        {actionError ? <p className="error" role="alert">{actionError}</p> : null}
    </AdminSectionEditor>
    {portalLink ? <CustomizationLinkModal url={portalLink} onClose={() => setPortalLink("")} /> : null}
  </Card></main>;
}
