"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { CustomizationFlow } from "../../customize/[token]/page";
import { formatCompactDate, formatMoney, formatTime } from "../../../lib/formatters";
import { loadPortal, uploadPortalReceipt, type PortalPayload } from "../../../lib/portal-storage";

export default function CustomerPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [portal, setPortal] = useState<PortalPayload | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [showSubmitted, setShowSubmitted] = useState(false);
  const [receipt, setReceipt] = useState<File>();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const reload = useCallback(() => loadPortal(token).then(setPortal).catch((reason) => setError(reason instanceof Error ? reason.message : "This link is invalid or no longer available.")), [token]);
  useEffect(() => { void reload(); }, [reload]);

  if (!portal) return <main className="hc-page"><Card><h2>Customer Portal</h2><p className={error ? "error" : undefined}>{error || "Loading..."}</p></Card></main>;
  if (portal.stage === "CUSTOMIZATION" && customizing) return <CustomizationFlow token={token} onComplete={() => { setCustomizing(false); void reload(); }} />;
  const { quotation, invoice } = portal;
  const packageName = quotation.packageSnapshot?.name || "Coffee Catering";
  const features = [...(quotation.packageSnapshot?.perks.map((item) => item.name) ?? []), ...quotation.selectedAddons.map((item) => item.name)];

  async function submitReceipt() {
    if (!receipt) return setError("Choose a payment receipt to upload.");
    setUploading(true); setError("");
    try { await uploadPortalReceipt(token, receipt); await reload(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to upload receipt."); }
    finally { setUploading(false); }
  }

  return <main className="hc-page portal-page"><div className="team-topbar">Hour Coffee - Customer Portal</div><Card className="wide-card portal-card">
    <header className="portal-heading"><p className="quotation-kicker">Customer Portal</p><h1>{invoice ? `Invoice ${invoice.invoiceNo}` : `Quotation ${quotation.quotationNo}`}</h1><p>{quotation.customer.companyName || quotation.customer.name}</p></header>
    {portal.stage === "QUOTATION" ? <>
      <section className="portal-section"><h2>Quotation</h2><p>Quotation No.: {quotation.quotationNo}</p><p>Package: {packageName}</p><p>Features / Add-ons: {features.join(", ") || "-"}</p>{quotation.serviceDates.map((date) => <p key={date.id}>{formatCompactDate(date.serviceDate)} · {date.cups} cups · {formatTime(date.startTime)}–{formatTime(date.endTime)}</p>)}<p><strong>Final quotation amount: {formatMoney(quotation.pricingSnapshot?.total ?? 0)}</strong></p></section>
      {quotation.quotationPdfUrl ? <a className="hc-button hc-button-primary" href={quotation.quotationPdfUrl} target="_blank" rel="noreferrer">View / Download Quotation</a> : null}
    </> : null}
    {invoice ? <section className="portal-section"><h2>Invoice</h2><div className="detail-grid"><div><h3>Billing</h3><p>{invoice.quotation.customer.companyName || invoice.quotation.customer.name}</p><p>{invoice.quotation.customer.billingAddress}</p></div><div><h3>Event</h3><p>{invoice.eventArea === "Others" ? invoice.eventAreaOther : invoice.eventArea}</p><p>{invoice.eventAddress}</p></div></div><p>Package: {invoice.quotation.packageSnapshot?.name || packageName}</p><p><strong>Amount Due: {formatMoney(invoice.quotation.pricingSnapshot?.total ?? 0)}</strong></p><p>Payment Status: {(invoice.paymentStatus ?? "UNPAID").replaceAll("_", " ")}</p>{invoice.invoicePdfUrl ? <a className="hc-button hc-button-secondary" href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer">View / Download Invoice</a> : null}</section> : null}
    {portal.stage === "PAYMENT" && invoice ? <section className="portal-section"><h2>Payment</h2>{invoice.paymentStatus === "RECEIPT_UPLOADED" ? <div className="ok-summary">Receipt submitted. Waiting for verification.</div> : <><label className="upload-box"><strong>Upload Payment Receipt</strong><span>PDF, PNG or JPG</span><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setReceipt(event.target.files?.[0])} /></label>{receipt ? <p>{receipt.name}</p> : null}<button className="hc-button hc-button-primary" disabled={uploading} onClick={submitReceipt}>{uploading ? "UPLOADING..." : "SUBMIT RECEIPT"}</button></>}</section> : null}
    {portal.stage === "CUSTOMIZATION" ? <section className="portal-section"><h2>Payment Verified</h2><p>Your event customization is now available.</p><button className="hc-button hc-button-primary" onClick={() => setCustomizing(true)}>Continue Customization</button></section> : null}
    {portal.stage === "COMPLETED" && invoice ? <section className="portal-section"><h2>Event Setup Completed</h2><p>Quotation: {quotation.quotationNo}</p><p>Invoice: {invoice.invoiceNo}</p><p>Payment: Verified</p><p>Customization: Submitted</p><div className="admin-file-actions">{invoice.invoicePdfUrl ? <a href={invoice.invoicePdfUrl} target="_blank" rel="noreferrer">View Invoice</a> : null}<button type="button" onClick={() => setShowSubmitted((value) => !value)}>View Submitted Customization</button></div>{showSubmitted && invoice.customizationSubmission ? <div className="mini-summary"><p>Event address: {invoice.customizationSubmission.eventAddress || "-"}</p><p>Dress code: {invoice.customizationSubmission.dressCode || "-"}</p><p>Environment: {invoice.customizationSubmission.environment || "-"}</p>{[...(invoice.customizationUrls ?? []).map((file) => ({ fileUrl: file.fileUrl, fileName: file.fileName })), ...(invoice.invoiceFiles ?? [])].map((file) => <p key={file.fileUrl}><a href={file.fileUrl} target="_blank" rel="noreferrer">{file.fileName}</a></p>)}</div> : null}</section> : null}
    {error ? <p className="error">{error}</p> : null}
  </Card></main>;
}
