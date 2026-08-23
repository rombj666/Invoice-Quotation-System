"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCompactDate, formatMoney } from "../../lib/formatters";
import { loadQuotationPackages } from "../../lib/packages";
import { resetQuotationAnalyticsSession, trackQuotationAnalytics } from "../../lib/quotation-analytics";
import { getNextQuotationNo, submitQuotationWithPdf } from "../../lib/quotation-storage";
import { hasText, isValidEmail, isValidMalaysiaPhone } from "../../lib/validators";
import type { QuotationData, QuotationPackage, ServiceDate } from "../../types/quotation";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { TextArea, TextInput } from "../common/FormField";
import { ProgressHeader } from "./ProgressHeader";

const totalSteps = 2;
const draftStorageKey = "hourCoffeeQuotationDraft";
export const submittedQuotationStorageKey = "hourCoffeeLastSubmittedQuotation";

function blankDate(index = 1): ServiceDate {
  return { id: `service-date-${Date.now()}-${index}`, serviceDate: "", cups: 50, durationMode: "HALF_DAY", startTime: "09:00", endTime: "13:00" };
}

function initialQuotation(): QuotationData {
  return {
    quotationNo: "Q00001",
    serviceDates: [blankDate()],
    selectedPackageId: undefined,
    totalCups: 50,
    serviceDuration: "HALF_DAY",
    location: "",
    fullAddress: "",
    eventType: "Coffee Catering",
    customEventType: "",
    drinkOrders: {},
    drinkDistributionModeByDate: {},
    excludedBeverageIdsByDate: {},
    beverageSnapshots: {},
    sameDrinkDistribution: false,
    letHourCoffeeDecideDrinks: true,
    selectedAddons: [],
    hasCupSleeves: false,
    hasCupStickers: false,
    customizationOptions: { cart: { mode: "same", designCount: 1 }, sticker: { mode: "same", designCount: 1 }, sleeve: { mode: "same", designCount: 1 } },
    customer: { name: "", phone: "", email: "", companyName: "", companyRegNo: "", billingAddress: "" },
    discountCode: "",
    discountPercent: 0,
    notes: "",
    linkExpiryDays: 7
  };
}

function finalPackageTotal(item: QuotationPackage, discountPercent: number) {
  return item.price * (1 - discountPercent / 100);
}

export function QuotationShell() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QuotationData>(initialQuotation);
  const [packages, setPackages] = useState<QuotationPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeQuotationNo, setActiveQuotationNo] = useState("Q00001");

  const selectedPackage = useMemo(() => packages.find((item) => item.id === data.selectedPackageId), [packages, data.selectedPackageId]);
  const finalTotal = selectedPackage ? finalPackageTotal(selectedPackage, data.discountPercent) : 0;

  useEffect(() => {
    trackQuotationAnalytics("OPEN", 0);
    const savedSubmission = window.localStorage.getItem(submittedQuotationStorageKey);
    if (savedSubmission) {
      try {
        const parsed = JSON.parse(savedSubmission) as { quotationNo?: string; status?: string };
        if (parsed.quotationNo && parsed.status === "submitted") {
          router.replace(`/quotation/submitted?quotationNo=${encodeURIComponent(parsed.quotationNo)}`);
          return;
        }
      } catch { window.localStorage.removeItem(submittedQuotationStorageKey); }
    }

    const savedDraft = window.localStorage.getItem(draftStorageKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as { version?: number; step?: number; data?: QuotationData };
        if (parsed.version === 6 && parsed.data?.customer && Array.isArray(parsed.data.serviceDates)) {
          setData(parsed.data);
          setStep(parsed.step === 1 ? 1 : 0);
          setActiveQuotationNo(parsed.data.quotationNo);
        }
      } catch { window.localStorage.removeItem(draftStorageKey); }
    }

    Promise.all([loadQuotationPackages(), getNextQuotationNo()])
      .then(([items, quotationNo]) => {
        setPackages(items);
        setData((current) => ({ ...current, quotationNo }));
        setActiveQuotationNo(quotationNo);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to prepare the quotation form."))
      .finally(() => { setPackagesLoading(false); setReady(true); });
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ version: 6, step, data }));
  }, [data, ready, step]);

  function setCustomer(field: "name" | "phone" | "email", value: string) {
    setData((current) => ({ ...current, customer: { ...current.customer, [field]: value } }));
  }

  function setAddress(value: string) {
    setData((current) => ({ ...current, location: value, customer: { ...current.customer, billingAddress: value } }));
  }

  function setCups(value: number) {
    setData((current) => ({ ...current, totalCups: value, serviceDates: current.serviceDates.map((date) => ({ ...date, cups: value })) }));
  }

  function setDate(index: number, value: string) {
    setData((current) => ({ ...current, serviceDates: current.serviceDates.map((date, dateIndex) => dateIndex === index ? { ...date, serviceDate: value } : date) }));
  }

  function validateBasicInfo() {
    if (!hasText(data.customer.name)) return setError("Enter your full name.");
    if (!isValidMalaysiaPhone(data.customer.phone)) return setError("Enter a valid Malaysian phone number.");
    if (!isValidEmail(data.customer.email)) return setError("Enter a valid email address.");
    if (!hasText(data.location)) return setError("Enter the event address.");
    if (!Number.isInteger(data.totalCups) || Number(data.totalCups) < 50) return setError("Minimum order is 50 cups.");
    if (!data.serviceDates.length || data.serviceDates.some((date) => !date.serviceDate)) return setError("Choose at least one event date.");
    if (new Set(data.serviceDates.map((date) => date.serviceDate)).size !== data.serviceDates.length) return setError("Each event date can only be selected once.");
    const discountCode = data.discountCode.trim().toUpperCase();
    if (discountCode && discountCode !== "FIRST") return setError("The discount code is not valid.");
    const discountPercent = discountCode === "FIRST" ? 5 : 0;
    setData((current) => ({ ...current, discountCode, discountPercent, serviceDates: current.serviceDates.map((date) => ({ ...date, cups: Number(current.totalCups), durationMode: "HALF_DAY", startTime: "09:00", endTime: "13:00" })) }));
    setError(""); setStep(1); trackQuotationAnalytics("ACTIVITY", 1); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function afterQuotationNumberPaint() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }

  async function submit() {
    if (!selectedPackage) return setError("Choose a package before submitting your quotation.");
    setError(""); setSubmitting(true);
    try {
      const packageSnapshot = { ...selectedPackage, createdAt: undefined, updatedAt: undefined };
      const quotation: QuotationData = {
        ...data,
        quotationNo: activeQuotationNo,
        selectedPackageId: selectedPackage.id,
        packageSnapshot,
        pricingSnapshot: { subtotal: selectedPackage.price, discountAmount: selectedPackage.price - finalTotal, total: finalTotal },
        expiresAt: new Date(Date.now() + data.linkExpiryDays * 86400000).toISOString()
      };
      const saved = await submitQuotationWithPdf(quotation, async (quotationNo) => { setActiveQuotationNo(quotationNo); setData((current) => ({ ...current, quotationNo })); await afterQuotationNumberPaint(); });
      window.localStorage.removeItem(draftStorageKey);
      window.localStorage.setItem(submittedQuotationStorageKey, JSON.stringify({ quotationNo: saved.quotationNo, status: "submitted", submittedAt: new Date().toISOString() }));
      router.push(`/quotation/submitted?quotationNo=${encodeURIComponent(saved.quotationNo)}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit the quotation."); }
    finally { setSubmitting(false); }
  }

  function resetForm() {
    window.localStorage.removeItem(draftStorageKey);
    window.localStorage.removeItem(submittedQuotationStorageKey);
    resetQuotationAnalyticsSession();
    const fresh = initialQuotation(); fresh.quotationNo = activeQuotationNo; setData(fresh); setStep(0); setError("");
  }

  return <main className="hc-page quotation-workspace">
    <Card className="quotation-flow-card">
      <ProgressHeader currentStep={step} totalSteps={totalSteps} steps={["Basic Info", "Select & Submit"]} />
      {step === 0 ? <div className="quotation-basic-step">
        <div className="step-intro"><p className="quotation-kicker">Your event, made memorable</p><h1>Let’s plan your coffee experience.</h1><p className="step-copy">Tell us the essentials. You’ll compare all packages on the next page.</p></div>
        <div className="basic-info-grid quotation-basic-grid">
          <TextInput className="basic-info-name" label="Customer Full Name" autoComplete="name" value={data.customer.name} onChange={(event) => setCustomer("name", event.target.value)} />
          <TextInput label="Phone Number" type="tel" autoComplete="tel" placeholder="01X-XXXXXXX" value={data.customer.phone} onChange={(event) => setCustomer("phone", event.target.value)} />
          <TextInput label="Email Address" type="email" autoComplete="email" value={data.customer.email} onChange={(event) => setCustomer("email", event.target.value)} />
          <TextArea className="basic-info-address" label="Event Address" rows={4} value={data.location} onChange={(event) => setAddress(event.target.value)} />
          <TextInput label="Discount Code (optional)" value={data.discountCode} onChange={(event) => setData((current) => ({ ...current, discountCode: event.target.value }))} hint="Enter FIRST if you have a first-order code." />
          <TextInput label="Total Cups" type="number" min={50} step={1} value={data.totalCups ?? 50} onChange={(event) => setCups(Number(event.target.value))} hint="Minimum order: 50 cups." />
        </div>

        <section className="quotation-date-panel"><div className="quotation-section-heading"><div><span>Schedule</span><h2>Choose Event Date(s)</h2></div><button type="button" onClick={() => setData((current) => ({ ...current, serviceDates: [...current.serviceDates, blankDate(current.serviceDates.length + 1)] }))}>+ Add another date</button></div>
          <div className="quotation-date-list">{data.serviceDates.map((date, index) => <div className="quotation-date-row" key={date.id}><span>{String(index + 1).padStart(2, "0")}</span><label><small>Event date</small><input type="date" value={date.serviceDate} onChange={(event) => setDate(index, event.target.value)} /></label>{data.serviceDates.length > 1 ? <button type="button" aria-label={`Remove event date ${index + 1}`} onClick={() => setData((current) => ({ ...current, serviceDates: current.serviceDates.filter((candidate) => candidate.id !== date.id) }))}>Remove</button> : null}</div>)}</div>
        </section>
        <TextArea label="Notes" rows={4} placeholder="Share any event details, preferences or special requests." value={data.notes ?? ""} onChange={(event) => setData((current) => ({ ...current, notes: event.target.value }))} />
        {error ? <p className="error">{error}</p> : null}
        <div className="hc-nav-row quotation-primary-action"><Button type="button" onClick={validateBasicInfo}>Continue to Packages</Button></div>
      </div> : <div className="quotation-package-step">
        <div className="step-intro package-step-intro"><div><p className="quotation-kicker">Four ways to serve</p><h1>Choose your package.</h1><p className="step-copy">Select a package to see what’s included, then review and submit below.</p></div><button type="button" onClick={() => setStep(0)}>Edit basic info</button></div>
        {packagesLoading ? <div className="package-loading">Loading packages…</div> : null}
        {!packagesLoading && !packages.length ? <div className="warn-summary">No quotation packages are currently configured. Please contact Hour Coffee or try again later.</div> : null}
        <div className="quotation-package-grid">{packages.map((item, index) => {
          const selected = item.id === selectedPackage?.id;
          return <button className={`quotation-package-card ${selected ? "selected" : ""}`} type="button" key={item.id} onClick={() => setData((current) => ({ ...current, selectedPackageId: item.id }))} aria-pressed={selected}>
            <span className="package-card-index">{String(index + 1).padStart(2, "0")}</span><span className="package-card-copy"><small>{item.level.replaceAll("_", " ")}</small><strong>{item.name}</strong><em>{item.briefDescription || "A thoughtfully prepared Hour Coffee package."}</em></span><span className="package-card-price"><small>Total</small><strong>{formatMoney(finalPackageTotal(item, data.discountPercent))}</strong></span><span className="package-card-check" aria-hidden="true">{selected ? "✓" : "→"}</span>
          </button>;
        })}</div>

        {selectedPackage ? <section className="selected-package-details"><div><span className="quotation-kicker">Selected package</span><h2>{selectedPackage.name}</h2><p>{selectedPackage.briefDescription}</p></div><div><h3>What’s included</h3><ul>{selectedPackage.perks.map((perk) => <li key={perk.id}><span>✓</span>{perk.name}</li>)}{!selectedPackage.perks.length ? <li>Package inclusions will be confirmed by our team.</li> : null}</ul></div></section> : <div className="package-selection-prompt">Select one package above to expand its inclusions.</div>}

        <section className="quotation-final-review"><div className="quotation-final-summary"><span className="quotation-kicker">Final review</span><h2>Your quotation at a glance</h2><div className="final-review-grid"><div><small>Customer</small><strong>{data.customer.name}</strong></div><div><small>Total cups</small><strong>{data.totalCups}</strong></div><div><small>Event address</small><strong>{data.location}</strong></div><div><small>Event date{data.serviceDates.length > 1 ? "s" : ""}</small><strong>{data.serviceDates.map((date) => formatCompactDate(date.serviceDate)).join(" · ")}</strong></div>{data.notes ? <div className="final-review-notes"><small>Notes</small><strong>{data.notes}</strong></div> : null}</div></div>
          <aside className="quotation-total-panel"><small>Final quotation total</small><strong>{selectedPackage ? formatMoney(finalTotal) : "—"}</strong>{data.discountPercent ? <span>FIRST code applied</span> : <span>Package total for your selected option</span>}<Button type="button" onClick={() => void submit()} disabled={!selectedPackage || submitting}>{submitting ? "Submitting…" : "Submit Quotation"}</Button></aside>
        </section>
        {error ? <p className="error">{error}</p> : null}
        <div className="hc-nav-row package-back-row"><Button type="button" variant="secondary" onClick={() => setStep(0)}>Back</Button><button type="button" className="start-over-link" onClick={resetForm}>Start over</button></div>
      </div>}
    </Card>

    <div className="print-document quotation-print-document"><div className="invoice-card quotation-card package-quotation-document" id="quotationPreview">
      <div className="invoice-header"><div><div className="invoice-title">QUOTATION</div><div className="invoice-meta"><div><span>Quotation No</span><strong>{activeQuotationNo}</strong></div><div><span>Quote Date</span><strong>{formatCompactDate(new Date())}</strong></div><div><span>Status</span><strong>Preview</strong></div></div></div><div className="invoice-brand">Hour Coffee</div></div>
      <div className="invoice-two-col"><div><span className="label-small">Prepared By</span><strong>HOUR COFFEE</strong><p>21, Jalan SS22/40, Damansara Jaya, 47400, Petaling Jaya, Selangor</p><p>contact@hourcoffee.com.my</p></div><div><span className="label-small">Prepared For</span><strong>{data.customer.name}</strong><p>{data.customer.phone}</p><p>{data.customer.email}</p></div></div>
      <div className="invoice-section"><h3>Event Summary</h3><div className="invoice-summary-grid"><div><span>Event address</span><strong>{data.location}</strong></div><div><span>Total cups</span><strong>{data.totalCups}</strong></div><div><span>Service dates</span><strong>{data.serviceDates.map((date) => date.serviceDate ? formatCompactDate(date.serviceDate) : "—").join(", ")}</strong></div>{data.notes ? <div><span>Notes</span><strong>{data.notes}</strong></div> : null}</div></div>
      <div className="invoice-section"><h3>Selected Package</h3><strong>{selectedPackage?.name ?? "—"}</strong><p>{selectedPackage?.briefDescription}</p><ul>{selectedPackage?.perks.map((perk) => <li key={perk.id}>{perk.name}</li>)}</ul></div>
      <div className="invoice-totals"><div className="final"><span>Total RM</span><strong>{formatMoney(finalTotal)}</strong></div></div><footer>Prepared by Hour Coffee.</footer>
    </div></div>
  </main>;
}
