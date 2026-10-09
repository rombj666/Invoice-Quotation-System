"use client";

import { calculateQuotationPricing as calculatePackagePricing, getQuotationPackageInput } from "@hour-coffee/shared";
import { calculateQuotationPricing } from "../../../../../lib/pricing";
import { formatMoney } from "../../../../../lib/formatters";
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

function calculateQuotationPricingSafe(data: QuotationData) {
  try { return calculateQuotationPricing(data); } catch { return null; }
}

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
        if ((loaded.status ?? "PENDING_APPROVAL") !== "PENDING_APPROVAL" || loaded.hasInvoice) return setError("Only pending approval quotations without an invoice can generate an invoice.");
        setEventAddress(loaded.fullAddress || loaded.location || "");
        setQuotation({ ...structuredClone(loaded), invoiceServiceTiming: true, totalCups: undefined, serviceDuration: undefined, serviceDates: loaded.serviceDates.map((date) => ({ ...date, durationMode: undefined })) });
        setInvoiceNo(nextNo);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load quotation."));
  }, [params.quotationNo, router]);

  if (!quotation || !invoiceNo) return <main className="admin-page"><Card className="admin-card"><h1>Generate Invoice</h1><p className={error ? "error" : undefined}>{error || "Loading..."}</p><Link href={`/admin/quotations/${params.quotationNo}`}>Back to quotation</Link></Card></main>;
  const packageInput = getQuotationPackageInput(quotation);
  let confirmedDraft = quotation;
  let pricingError = packageInput ? "" : "This saved package has no pricing configuration. Please update the package configuration before generating an invoice.";
  try {
    const breakdown = packageInput ? calculatePackagePricing(packageInput) : null;
    if (breakdown) confirmedDraft = { ...quotation, packageSnapshot: quotation.packageSnapshot ? { ...quotation.packageSnapshot, price: breakdown.subtotal, extendedDayCharge: breakdown.extendedDayCharge } : undefined, pricingSnapshot: { ...quotation.pricingSnapshot, ...breakdown, total: breakdown.finalTotal } };
  } catch (reason) { pricingError = reason instanceof Error ? reason.message : "Complete the service dates."; }
  const pricing = calculateQuotationPricingSafe(confirmedDraft);

  const patch = (value: Partial<QuotationData>) => setQuotation((current) => current ? { ...current, ...value } : current);
  const customer = (key: keyof QuotationData["customer"], value: string) => patch({ customer: { ...confirmedDraft.customer, [key]: value } });
  const date = (id: string, value: Partial<ServiceDate>) => patch({ serviceDates: confirmedDraft.serviceDates.map((item) => item.id === id ? { ...item, ...value } : item) });
  const addDate = () => patch({ serviceDates: [...quotation.serviceDates, { id: crypto.randomUUID(), serviceDate: "", cups: 50, startTime: "09:00", endTime: "13:00" }] });
  const removeDate = (id: string) => patch({ serviceDates: quotation.serviceDates.filter((item) => item.id !== id), extraCharges: quotation.extraCharges?.map((charge) => ({ ...charge, serviceDateIds: charge.serviceDateIds?.filter((dateId) => dateId !== id) })) });
  const draft: InvoiceDetails = { invoiceNo, invoiceStatus: "SUBMITTED", paymentStatus: "UNPAID", quotation: confirmedDraft, eventArea, eventAreaOther, eventAddress, dressCode: "", customDressCode: "", environment: "", environmentNotes: "", receiptName: "" };

  function next(nextStep: Step) {
    setError("");
    if (nextStep > 1 && (!confirmedDraft.customer.name.trim() || !confirmedDraft.customer.phone.trim() || !confirmedDraft.customer.email.trim() || !confirmedDraft.customer.billingAddress.trim())) return setError("Complete the customer contact and billing address fields.");
    if (nextStep === 3 && (!eventAddress.trim() || (eventArea === "Others" && !eventAreaOther.trim()))) return setError("Complete the event area and exact event address.");
    if (nextStep === 3 && (pricingError || !quotation?.serviceDates.length || quotation.serviceDates.some((date) => date.cups < 50 || !date.startTime || !date.endTime || date.endTime <= date.startTime))) return setError(pricingError || "Each service date needs at least 50 cups and a valid start/end time.");
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
    <div className="admin-page-header"><div><p className="admin-eyebrow">Quotation {quotation.quotationNo}</p><h1>Generate Invoice</h1><p>Confirm the final invoice snapshot without changing the submitted quotation.</p></div><Link className="admin-link-button" href={`/admin/quotations/${quotation.quotationNo}`}>Cancel</Link></div>
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
      <label className="admin-field"><span>Discount Percent</span><input type="number" min="0" max="100" step="0.01" value={quotation.discountPercent} onChange={(e) => patch({ discountPercent: Number(e.target.value) })} /></label>
    </div></section>
    <section className="admin-edit-section invoice-service-date-editor"><div className="admin-section-heading"><h2>Service Dates</h2><button className="admin-link-button" type="button" onClick={addDate}>+ Add Date</button></div>{quotation.serviceDates.map((item) => <div className="invoice-service-date-row" key={item.id}>
      <label className="admin-field"><span>Date</span><input type="date" value={item.serviceDate} onChange={(e) => date(item.id, { serviceDate: e.target.value })} /></label>
      <label className="admin-field"><span>Cups</span><input type="number" min="50" value={item.cups} onChange={(e) => date(item.id, { cups: Number(e.target.value) })} /></label>
      <label className="admin-field"><span>Start Time</span><input type="time" value={item.startTime} onChange={(e) => date(item.id, { startTime: e.target.value })} /></label>
      <label className="admin-field"><span>End Time</span><input type="time" value={item.endTime} onChange={(e) => date(item.id, { endTime: e.target.value })} /></label>
      <button className="admin-link-button invoice-remove-date" type="button" aria-label={`Remove service date ${item.serviceDate || "new date"}`} disabled={quotation.serviceDates.length === 1} onClick={() => removeDate(item.id)}>Remove</button>
    </div>)}<p aria-live="polite">{pricingError || (pricing ? `Total: ${formatMoney(pricing.total)}` : "Complete the service dates to calculate pricing.")}</p></section>
    <section className="admin-edit-section"><h2>Package, Features &amp; Charges</h2><p><strong>{quotation.packageSnapshot?.name || "Saved quotation package"}</strong></p>{quotation.packageSnapshot?.perks.map((perk) => <p key={perk.id}>✓ {perk.name}</p>)}{quotation.selectedAddons.map((addon) => <label className="admin-field" key={addon.name}><span>{addon.name}</span><input type="number" min="0" step="0.01" value={addon.price} onChange={(e) => patch({ selectedAddons: quotation.selectedAddons.map((item) => item.name === addon.name ? { ...item, price: Number(e.target.value) } : item) })} /></label>)}{(quotation.extraCharges ?? []).map((charge) => <div key={charge.id}><label className="admin-field"><span>{charge.title}</span><input type="number" min="0" step="0.01" value={charge.amount} onChange={(e) => patch({ extraCharges: quotation.extraCharges?.map((item) => item.id === charge.id ? { ...item, amount: Number(e.target.value) } : item) })} /></label>{charge.appliesToAllDates === false ? <fieldset><legend>Applicable service dates</legend>{quotation.serviceDates.map((date) => <label key={date.id}><input type="checkbox" checked={charge.serviceDateIds?.includes(date.id) ?? false} onChange={(event) => patch({ extraCharges: quotation.extraCharges?.map((item) => item.id === charge.id ? { ...item, serviceDateIds: event.target.checked ? [...(item.serviceDateIds ?? []), date.id] : item.serviceDateIds?.filter((id) => id !== date.id) } : item) })} />{date.serviceDate || "New date"}</label>)}{!charge.serviceDateIds?.length ? <p className="error">Choose a remaining service date for this charge.</p> : null}</fieldset> : null}</div>)}</section>
    <div className="admin-edit-actions"><button className="hc-button hc-button-secondary" onClick={() => setStep(1)}>Back</button><button className="hc-button hc-button-primary" onClick={() => next(3)}>Review Invoice</button></div></> : null}

    {step === 3 ? <><div className="admin-review-heading"><h2>Final Invoice Preview</h2><div><button onClick={() => setStep(1)}>Edit customer</button><button onClick={() => setStep(2)}>Edit event &amp; order</button></div></div><InvoicePreview invoiceNo={invoiceNo} quotation={confirmedDraft} invoice={draft} documentId="adminInvoicePreview" showDownloadButton={false} /><div className="admin-edit-actions"><button className="hc-button hc-button-secondary" onClick={() => setStep(2)}>Back</button><button className="hc-button hc-button-primary" disabled={saving} onClick={generate}>{saving ? "Generating..." : "Generate Final Unpaid Invoice"}</button></div></> : null}
  </Card></main>;
}
