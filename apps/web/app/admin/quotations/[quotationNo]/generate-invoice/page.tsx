"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "../../../../../components/common/Card";
import { InvoicePreview } from "../../../../../components/invoice/InvoicePreview";
import { generateAdminInvoice, prepareAdminQuotationEdit } from "../../../../../lib/admin-api";
import { getNextInvoiceNo, loadAllInvoices } from "../../../../../lib/invoice-storage";
import { generatePdfBlob } from "../../../../../lib/pdf-document";
import { loadQuotationByNo } from "../../../../../lib/quotation-storage";
import type { InvoiceDetails } from "../../../../../types/invoice";
import type { QuotationData, ServiceDate } from "../../../../../types/quotation";

type Step = 1 | 2 | 3;

export default function GenerateInvoicePage() {
  const params = useParams<{ quotationNo: string }>();
  const router = useRouter();
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [eventArea, setEventArea] = useState<"Selangor" | "Others">("Selangor");
  const [eventAreaOther, setEventAreaOther] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([loadQuotationByNo(params.quotationNo), loadAllInvoices(), getNextInvoiceNo()])
      .then(([loaded, invoices, nextNo]) => {
        const existing = invoices.find((item) => item.quotation.quotationNo === params.quotationNo);
        if (existing) return router.replace(`/admin/invoices/${existing.invoiceNo}`);
        if (!loaded) return setError("Quotation not found.");
        if (loaded.status !== "APPROVED") return setError("Only approved quotations can generate an invoice.");
        setQuotation(structuredClone(loaded));
        setInvoiceNo(nextNo);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load quotation."));
  }, [params.quotationNo, router]);

  if (!quotation || !invoiceNo) return <main className="admin-page"><Card className="admin-card"><h1>Generate Invoice</h1><p className={error ? "error" : undefined}>{error || "Loading..."}</p><Link href={`/admin/quotations/${params.quotationNo}`}>Back to quotation</Link></Card></main>;
  const confirmedDraft = quotation;

  const patch = (value: Partial<QuotationData>) => setQuotation((current) => current ? { ...current, ...value } : current);
  const customer = (key: keyof QuotationData["customer"], value: string) => patch({ customer: { ...confirmedDraft.customer, [key]: value } });
  const date = (id: string, value: Partial<ServiceDate>) => patch({ serviceDates: confirmedDraft.serviceDates.map((item) => item.id === id ? { ...item, ...value } : item) });
  const draft: InvoiceDetails = { invoiceNo, invoiceStatus: "SUBMITTED", paymentStatus: "UNPAID", quotation: confirmedDraft, eventArea, eventAreaOther, eventAddress, dressCode: "", customDressCode: "", environment: "", environmentNotes: "", receiptName: "" };

  function next(nextStep: Step) {
    setError("");
    if (step === 1 && (!confirmedDraft.customer.name.trim() || !confirmedDraft.customer.phone.trim() || !confirmedDraft.customer.email.trim() || !confirmedDraft.customer.billingAddress.trim())) return setError("Complete the customer contact and billing address fields.");
    if (step === 2 && (!eventAddress.trim() || (eventArea === "Others" && !eventAreaOther.trim()))) return setError("Complete the event area and exact event address.");
    setStep(nextStep);
  }

  async function generate() {
    setSaving(true); setError("");
    try {
      const confirmed = await prepareAdminQuotationEdit(params.quotationNo, confirmedDraft);
      const payload = { ...draft, quotation: confirmed };
      setQuotation(confirmed);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const pdf = await generatePdfBlob("adminInvoicePreview", { filename: `Hour-Coffee-Invoice-${invoiceNo}.pdf` });
      const saved = await generateAdminInvoice(params.quotationNo, payload, pdf);
      router.replace(`/admin/invoices/${saved.invoiceNo}`);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate invoice.");
    } finally { setSaving(false); }
  }

  return <main className="admin-page"><Card className="admin-card admin-edit-card">
    <div className="admin-page-header"><div><p className="admin-eyebrow">Approved quotation {quotation.quotationNo}</p><h1>Generate Invoice</h1><p>Confirm the final invoice snapshot without changing the approved quotation.</p></div><Link className="admin-link-button" href={`/admin/quotations/${quotation.quotationNo}`}>Cancel</Link></div>
    <div className="admin-invoice-steps" aria-label="Invoice generation progress"><button className={step === 1 ? "active" : ""} onClick={() => setStep(1)}>1. Customer &amp; Company</button><button className={step === 2 ? "active" : ""} onClick={() => next(2)}>2. Event &amp; Order</button><button className={step === 3 ? "active" : ""} onClick={() => next(3)}>3. Review &amp; Generate</button></div>
    {error ? <p className="error">{error}</p> : null}

    {step === 1 ? <section className="admin-edit-section"><h2>Customer &amp; Company</h2><div className="admin-form-grid">
      <label className="admin-field"><span>Company Name</span><input value={quotation.customer.companyName} onChange={(e) => customer("companyName", e.target.value)} /></label>
      <label className="admin-field"><span>Billing Address</span><textarea rows={4} value={quotation.customer.billingAddress} onChange={(e) => customer("billingAddress", e.target.value)} /></label>
      <label className="admin-field"><span>Company Registration Number</span><input value={quotation.customer.companyRegNo} onChange={(e) => customer("companyRegNo", e.target.value)} /></label>
      <label className="admin-field"><span>PIC / Customer Name</span><input value={quotation.customer.name} onChange={(e) => customer("name", e.target.value)} /></label>
      <label className="admin-field"><span>Phone</span><input value={quotation.customer.phone} onChange={(e) => customer("phone", e.target.value)} /></label>
      <label className="admin-field"><span>Email</span><input type="email" value={quotation.customer.email} onChange={(e) => customer("email", e.target.value)} /></label>
    </div><div className="admin-edit-actions"><button className="hc-button hc-button-primary" onClick={() => next(2)}>Continue to Event &amp; Order</button></div></section> : null}

    {step === 2 ? <><section className="admin-edit-section"><h2>Event Information</h2><div className="admin-form-grid">
      <label className="admin-field"><span>Event Area</span><select value={eventArea} onChange={(e) => setEventArea(e.target.value as "Selangor" | "Others")}><option>Selangor</option><option>Others</option></select></label>
      {eventArea === "Others" ? <label className="admin-field"><span>Other Area</span><input value={eventAreaOther} onChange={(e) => setEventAreaOther(e.target.value)} /></label> : null}
      <label className="admin-field"><span>Event Address</span><textarea rows={4} value={eventAddress} onChange={(e) => setEventAddress(e.target.value)} placeholder="Exact venue address" /></label>
      {Number.isFinite(quotation.totalCups) ? <label className="admin-field"><span>Total Cups</span><input type="number" min="50" value={quotation.totalCups} onChange={(e) => patch({ totalCups: Number(e.target.value) })} /></label> : null}
      {quotation.serviceDuration ? <label className="admin-field"><span>Event Duration</span><select value={quotation.serviceDuration} onChange={(e) => { const duration = e.target.value as "HALF_DAY" | "FULL_DAY"; patch({ serviceDuration: duration, serviceDates: quotation.serviceDates.map((item) => ({ ...item, durationMode: duration, startTime: "09:00", endTime: duration === "FULL_DAY" ? "17:00" : "13:00" })) }); }}><option value="HALF_DAY">Half Day</option><option value="FULL_DAY">Full Day</option></select></label> : null}
      <label className="admin-field"><span>Discount Percent</span><input type="number" min="0" max="100" step="0.01" value={quotation.discountPercent} onChange={(e) => patch({ discountPercent: Number(e.target.value) })} /></label>
    </div></section>
    <section className="admin-edit-section"><h2>Dates, Duration &amp; Cups</h2>{quotation.serviceDates.map((item) => <div className="admin-inline-fields" key={item.id}><label className="admin-field"><span>Date</span><input type="date" value={item.serviceDate} onChange={(e) => date(item.id, { serviceDate: e.target.value })} /></label><label className="admin-field"><span>Cups</span><input type="number" min="50" value={item.cups} onChange={(e) => date(item.id, { cups: Number(e.target.value) })} /></label>{item.durationMode ? <label className="admin-field"><span>Duration</span><select value={item.durationMode} onChange={(e) => date(item.id, { durationMode: e.target.value as ServiceDate["durationMode"], endTime: e.target.value === "FULL_DAY" ? "17:00" : "13:00" })}><option value="HALF_DAY">Half Day</option><option value="FULL_DAY">Full Day</option></select></label> : <><label className="admin-field"><span>Start Time</span><input type="time" value={item.startTime} onChange={(e) => date(item.id, { startTime: e.target.value })} /></label><label className="admin-field"><span>End Time</span><input type="time" value={item.endTime} onChange={(e) => date(item.id, { endTime: e.target.value })} /></label></>}</div>)}</section>
    <section className="admin-edit-section"><h2>Package, Features &amp; Charges</h2><p><strong>{quotation.packageSnapshot?.name || "Saved quotation package"}</strong></p>{quotation.packageSnapshot?.perks.map((perk) => <p key={perk.id}>✓ {perk.name}</p>)}{quotation.selectedAddons.map((addon) => <label className="admin-field" key={addon.name}><span>{addon.name}</span><input type="number" min="0" step="0.01" value={addon.price} onChange={(e) => patch({ selectedAddons: quotation.selectedAddons.map((item) => item.name === addon.name ? { ...item, price: Number(e.target.value) } : item) })} /></label>)}{(quotation.extraCharges ?? []).map((charge) => <label className="admin-field" key={charge.id}><span>{charge.title}</span><input type="number" min="0" step="0.01" value={charge.amount} onChange={(e) => patch({ extraCharges: quotation.extraCharges?.map((item) => item.id === charge.id ? { ...item, amount: Number(e.target.value) } : item) })} /></label>)}</section>
    <div className="admin-edit-actions"><button className="hc-button hc-button-secondary" onClick={() => setStep(1)}>Back</button><button className="hc-button hc-button-primary" onClick={() => next(3)}>Review Invoice</button></div></> : null}

    {step === 3 ? <><div className="admin-review-heading"><h2>Final Invoice Preview</h2><div><button onClick={() => setStep(1)}>Edit customer</button><button onClick={() => setStep(2)}>Edit event &amp; order</button></div></div><InvoicePreview invoiceNo={invoiceNo} quotation={quotation} invoice={draft} documentId="adminInvoicePreview" showDownloadButton={false} /><div className="admin-edit-actions"><button className="hc-button hc-button-secondary" onClick={() => setStep(2)}>Back</button><button className="hc-button hc-button-primary" disabled={saving} onClick={generate}>{saving ? "Generating..." : "Generate Final Unpaid Invoice"}</button></div></> : null}
  </Card></main>;
}
