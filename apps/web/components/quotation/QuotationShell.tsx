"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMinimumSelectableDate, toLocalIsoDate } from "../../lib/calendar";
import { formatCompactDate, formatMoney } from "../../lib/formatters";
import { loadQuotationPackages } from "../../lib/packages";
import { resetQuotationAnalyticsSession, trackQuotationAnalytics } from "../../lib/quotation-analytics";
import { getNextQuotationNo, previewQuotationPricing, submitQuotationWithPdf } from "../../lib/quotation-storage";
import { hasText, isValidEmail, isValidMalaysiaPhone } from "../../lib/validators";
import type { CartStyle, FixedPackageDisplay, PackageCode, PackageOptionCode, QuotationData, QuotationPricingPreview, ServiceDate } from "../../types/quotation";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { TextArea, TextInput } from "../common/FormField";
import { ProgressHeader } from "./ProgressHeader";

const totalSteps = 2;
const draftStorageKey = "hourCoffeeQuotationDraft";
export const submittedQuotationStorageKey = "hourCoffeeLastSubmittedQuotation";

const PACKAGE_ICONS: Record<PackageCode, string> = {
  CONFERENCE: "01",
  EXHIBITOR: "02",
  BRAND_LAUNCH: "03",
  CUSTOMIZE: "+"
};

const CART_DESCRIPTIONS: Record<CartStyle, string> = {
  EQUIPMENT_CART: "Standard Hour Coffee service cart.",
  FOAM_BOARD_DISPLAY_CART: "Branded display cart with custom foam-board/logo presentation."
};

function blankServiceDate(value: string, index: number): ServiceDate {
  return { id: `service-date-${Date.now()}-${index}`, serviceDate: value, cups: 0, startTime: "", endTime: "" };
}

function initialQuotation(): QuotationData {
  return {
    quotationNo: "Q00001",
    serviceDates: [],
    selectedDates: [],
    selectedPackageId: undefined,
    packageCode: undefined,
    selectedOptions: [],
    extendToEightHours: false,
    totalCups: 50,
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

function displayDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  try { input.showPicker?.(); }
  catch { input.focus(); input.click(); }
}

function getCustomizeDefaultCart(item: FixedPackageDisplay): CartStyle | undefined {
  return item.availableCartStyles.find((cart) => cart.code === "EQUIPMENT_CART")?.code
    ?? item.defaultCart
    ?? item.availableCartStyles[0]?.code;
}

export function QuotationShell() {
  const router = useRouter();
  const newDateInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QuotationData>(initialQuotation);
  const [packages, setPackages] = useState<FixedPackageDisplay[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [dateError, setDateError] = useState("");
  const [preview, setPreview] = useState<QuotationPricingPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeQuotationNo, setActiveQuotationNo] = useState("Q00001");
  const minimumDate = useMemo(() => toLocalIsoDate(getMinimumSelectableDate()), []);

  const selectedPackage = useMemo(() => packages.find((item) => item.code === data.packageCode), [packages, data.packageCode]);
  const averageCupsPerDay = data.serviceDates.length ? Number(data.totalCups ?? 0) / data.serviceDates.length : 0;
  const standardServiceHours = averageCupsPerDay < 200 ? 4 : 8;

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
        if (parsed.version === 7 && parsed.data?.customer && Array.isArray(parsed.data.serviceDates)) {
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
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ version: 7, step, data }));
  }, [data, ready, step]);

  useEffect(() => {
    if (standardServiceHours === 8 && data.extendToEightHours) {
      setData((current) => ({ ...current, extendToEightHours: false }));
    }
  }, [data.extendToEightHours, standardServiceHours]);

  useEffect(() => {
    if (!selectedPackage) return;
    setData((current) => {
      if (current.packageCode !== selectedPackage.code) return current;
      if (selectedPackage.code === "CUSTOMIZE") {
        const hasValidCart = selectedPackage.availableCartStyles.some((cart) => cart.code === current.cartStyle);
        return hasValidCart ? current : { ...current, cartStyle: getCustomizeDefaultCart(selectedPackage) };
      }
      const isAlreadyFixed = !(current.selectedOptions?.length) && !current.extendToEightHours && current.cartStyle === selectedPackage.defaultCart;
      return isAlreadyFixed ? current : { ...current, selectedOptions: [], extendToEightHours: false, cartStyle: selectedPackage.defaultCart };
    });
  }, [selectedPackage]);

  useEffect(() => {
    if (step !== 1 || !data.packageCode) { setPreview(null); setPreviewError(""); return; }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError("");
      previewQuotationPricing(data)
        .then((result) => { if (!cancelled) setPreview(result); })
        .catch((reason) => {
          if (!cancelled) {
            setPreview(null);
            setPreviewError(reason instanceof Error ? reason.message : "Unable to calculate this package.");
          }
        })
        .finally(() => { if (!cancelled) setPreviewLoading(false); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [data.cartStyle, data.discountCode, data.extendToEightHours, data.packageCode, data.selectedOptions, data.serviceDates, data.totalCups, step]);

  function setCustomer(field: "name" | "phone" | "email", value: string) {
    setData((current) => ({ ...current, customer: { ...current.customer, [field]: value } }));
  }

  function setAddress(value: string) {
    setData((current) => ({ ...current, location: value, fullAddress: value, customer: { ...current.customer, billingAddress: value } }));
  }

  function addDate(value: string) {
    if (!value) return;
    if (value < minimumDate) return setDateError("This date is unavailable. Please choose a date at least 6 days from today.");
    if (data.serviceDates.some((date) => date.serviceDate === value)) return setDateError("This event date has already been selected.");
    setData((current) => {
      const next = [...current.serviceDates, blankServiceDate(value, current.serviceDates.length + 1)].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
      return { ...current, serviceDates: next, selectedDates: next.map((date) => date.serviceDate) };
    });
    setDateError("");
    if (newDateInputRef.current) newDateInputRef.current.value = "";
  }

  function editDate(id: string, value: string) {
    if (!value) return;
    if (value < minimumDate) return setDateError("This date is unavailable. Please choose a date at least 6 days from today.");
    if (data.serviceDates.some((date) => date.id !== id && date.serviceDate === value)) return setDateError("This event date has already been selected.");
    setData((current) => {
      const next = current.serviceDates.map((date) => date.id === id ? { ...date, serviceDate: value } : date).sort((a, b) => a.serviceDate.localeCompare(b.serviceDate));
      return { ...current, serviceDates: next, selectedDates: next.map((date) => date.serviceDate) };
    });
    setDateError("");
  }

  function removeDate(id: string) {
    setData((current) => {
      const next = current.serviceDates.filter((date) => date.id !== id);
      return { ...current, serviceDates: next, selectedDates: next.map((date) => date.serviceDate) };
    });
    setDateError("");
  }

  function validateBasicInfo() {
    if (!hasText(data.customer.name)) return setError("Enter your full name.");
    if (!isValidMalaysiaPhone(data.customer.phone)) return setError("Enter a valid Malaysian phone number.");
    if (!isValidEmail(data.customer.email)) return setError("Enter a valid email address.");
    if (!hasText(data.location)) return setError("Enter the event address.");
    if (!Number.isInteger(data.totalCups) || Number(data.totalCups) < 50) return setError("Minimum order is 50 cups.");
    if (!data.serviceDates.length) return setError("Choose at least one event date.");
    if (data.serviceDates.some((date) => !date.serviceDate || date.serviceDate < minimumDate)) return setError("One or more selected event dates are unavailable.");
    if (new Set(data.serviceDates.map((date) => date.serviceDate)).size !== data.serviceDates.length) return setError("Each event date can only be selected once.");
    const discountCode = data.discountCode.trim().toUpperCase();
    if (discountCode && discountCode !== "FIRST") return setError("The discount code is not valid.");
    setData((current) => ({ ...current, discountCode, discountPercent: discountCode === "FIRST" ? 5 : 0 }));
    setError("");
    setStep(1);
    trackQuotationAnalytics("ACTIVITY", 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectPackage(item: FixedPackageDisplay) {
    setData((current) => {
      const isCustomize = item.code === "CUSTOMIZE";
      const selectedOptions = isCustomize
        ? (current.selectedOptions ?? []).filter((option) => item.availableOptions.some((available) => available.code === option))
        : [];
      const cartStyle = isCustomize && current.cartStyle && item.availableCartStyles.some((available) => available.code === current.cartStyle)
        ? current.cartStyle
        : isCustomize ? getCustomizeDefaultCart(item) : item.defaultCart;
      return { ...current, packageCode: item.code, selectedPackageId: item.id, selectedOptions, cartStyle, extendToEightHours: isCustomize ? current.extendToEightHours : false };
    });
    setError("");
  }

  function toggleOption(option: PackageOptionCode) {
    setData((current) => {
      const selected = current.selectedOptions ?? [];
      return { ...current, selectedOptions: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] };
    });
  }

  function afterQuotationNumberPaint() {
    return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }

  async function submit() {
    if (!selectedPackage || !data.packageCode) return setError("Choose a package before submitting your quotation.");
    if (!preview || previewError) return setError(previewError || "Wait for the quotation total to finish updating.");
    setError("");
    setSubmitting(true);
    try {
      const quotation: QuotationData = {
        ...data,
        quotationNo: activeQuotationNo,
        selectedDates: data.serviceDates.map((date) => date.serviceDate),
        pricingSnapshot: { subtotal: preview.finalTotal, discountAmount: 0, total: preview.finalTotal },
        expiresAt: new Date(Date.now() + data.linkExpiryDays * 86400000).toISOString()
      };
      const saved = await submitQuotationWithPdf(quotation, async (quotationNo) => {
        setActiveQuotationNo(quotationNo);
        setData((current) => ({ ...current, quotationNo }));
        await afterQuotationNumberPaint();
      });
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
    const fresh = initialQuotation();
    fresh.quotationNo = activeQuotationNo;
    setData(fresh);
    setStep(0);
    setPreview(null);
    setError("");
  }

  return <main className="hc-page quotation-workspace">
    <Card className="quotation-flow-card">
      <ProgressHeader currentStep={step} totalSteps={totalSteps} steps={["Basic Info & Event Details", "Choose, Review & Submit"]} />

      {step === 0 ? <div className="quotation-basic-step">
        <div className="step-intro"><p className="quotation-kicker">Your event, made memorable</p><h1>Basic Info &amp; Event Details</h1><p className="step-copy">Tell us about your event, then choose and customize your package.</p></div>
        <div className="basic-info-grid quotation-basic-grid">
          <TextInput className="basic-info-name" label="Customer Full Name" required autoComplete="name" value={data.customer.name} onChange={(event) => setCustomer("name", event.target.value)} />
          <TextInput label="Phone Number" required type="tel" autoComplete="tel" placeholder="01X-XXXXXXX" value={data.customer.phone} onChange={(event) => setCustomer("phone", event.target.value)} />
          <TextInput label="Email Address" required type="email" autoComplete="email" value={data.customer.email} onChange={(event) => setCustomer("email", event.target.value)} />
          <TextArea className="basic-info-address" label="Event Address" required rows={3} value={data.location} onChange={(event) => setAddress(event.target.value)} />
          <TextInput label="Discount Code (optional)" value={data.discountCode} onChange={(event) => setData((current) => ({ ...current, discountCode: event.target.value }))} hint={data.discountCode.trim().toUpperCase() === "FIRST" ? "FIRST applied — 5% discount" : "Enter FIRST if you have a first-order code."} />
          <TextInput label="Total Cups" required type="number" min={50} step={1} value={data.totalCups ?? ""} onChange={(event) => setData((current) => ({ ...current, totalCups: event.target.value === "" ? undefined : Number(event.target.value) }))} hint="One total for the entire engagement. Minimum order: 50 cups." />
        </div>

        <section className="quotation-date-panel compact-date-panel">
          <div className="quotation-section-heading"><div><span>Schedule</span><h2>Event Dates</h2></div></div>
          {data.serviceDates.length ? <div className="quotation-date-chips">{data.serviceDates.map((date) => <span className="quotation-date-chip" key={date.id}>
            <strong>{displayDate(date.serviceDate)}</strong>
            <button type="button" aria-label={`Edit ${displayDate(date.serviceDate)}`} onClick={() => openNativeDatePicker(document.getElementById(`edit-${date.id}`) as HTMLInputElement)}>✎</button>
            <input className="date-chip-native-picker" id={`edit-${date.id}`} type="date" min={minimumDate} value={date.serviceDate} onChange={(event) => editDate(date.id, event.target.value)} />
            <button type="button" aria-label={`Remove ${displayDate(date.serviceDate)}`} onClick={() => removeDate(date.id)}>×</button>
          </span>)}</div> : <p className="selected-dates-empty">No event dates selected yet.</p>}
          <div className="compact-date-add">
            <button type="button" onClick={() => openNativeDatePicker(newDateInputRef.current)}>{data.serviceDates.length ? "+ Add another date" : "+ Add Event Date"}</button>
            <input ref={newDateInputRef} className="date-chip-native-picker" aria-label="Add event date" type="date" min={minimumDate} onChange={(event) => addDate(event.target.value)} />
          </div>
          {dateError ? <p className="error compact-date-error">{dateError}</p> : null}
        </section>

        <TextArea label="Notes (optional)" rows={4} placeholder="Share any event details, preferences or special requests." value={data.notes ?? ""} onChange={(event) => setData((current) => ({ ...current, notes: event.target.value }))} />
        {error ? <p className="error">{error}</p> : null}
        <div className="hc-nav-row quotation-primary-action"><Button type="button" onClick={validateBasicInfo}>Continue to Packages</Button></div>
      </div> : <div className="quotation-package-step">
        <div className="step-intro package-step-intro"><div><p className="quotation-kicker">Choose your service</p><h1>Packages</h1><p className="step-copy">Select a package to see what is included.</p></div><button type="button" onClick={() => setStep(0)}>Edit event</button></div>
        {packagesLoading ? <div className="package-loading">Loading packages...</div> : null}
        <div className="package-selection-layout">
          <div className="quotation-package-grid fixed-package-choice-grid" aria-label="Quotation packages">{packages.map((item) => {
            const selected = item.code === data.packageCode;
            return <button className={`quotation-package-card fixed-package-choice ${selected ? "selected" : ""}`} type="button" key={item.code} onClick={() => selectPackage(item)} aria-pressed={selected}>
              <span className="package-card-icon" aria-hidden="true">{PACKAGE_ICONS[item.code]}</span>
              <span className="package-card-copy"><small>{item.code === "CUSTOMIZE" ? "Flexible" : "Fixed package"}</small><strong>{item.name}</strong><b>{selected ? "Selected" : "View details"}</b></span>
              <span className="package-card-check" aria-hidden="true">{selected ? "✓" : "→"}</span>
            </button>;
          })}</div>

          {selectedPackage ? <section className="package-detail-panel" key={selectedPackage.code} aria-live="polite" aria-label={`${selectedPackage.name} package details`}>
            <header className="package-detail-heading"><div><span>{selectedPackage.code === "CUSTOMIZE" ? "Flexible package" : "Fixed package"}</span><h2>{selectedPackage.name}</h2><p>{selectedPackage.shortDescription}</p></div><strong aria-label="Selected">✓</strong></header>
            <div className={`package-detail-content ${selectedPackage.code === "CUSTOMIZE" ? "is-custom" : "is-fixed"}`}>
              <section className="package-option-group package-inclusions"><h3>Included</h3><ul>{selectedPackage.includedItems.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul></section>
              {selectedPackage.code === "CUSTOMIZE" ? <div className="package-builder-controls">
                {selectedPackage.availableCartStyles.length ? <fieldset className="package-option-group package-radio-group"><legend>Cart</legend>{selectedPackage.availableCartStyles.map((cart) => <label className={data.cartStyle === cart.code ? "selected" : ""} key={cart.code}><input type="radio" name="cart-style" checked={data.cartStyle === cart.code} onChange={() => setData((current) => ({ ...current, cartStyle: cart.code }))} /><span><strong>{cart.label}</strong><small>{CART_DESCRIPTIONS[cart.code]}</small></span></label>)}</fieldset> : null}
                {selectedPackage.availableOptions.length ? <section className="package-option-group"><h3>Extras</h3><div className="package-checkbox-grid">{selectedPackage.availableOptions.map((option) => <label className={data.selectedOptions?.includes(option.code) ? "selected" : ""} key={option.code}><input type="checkbox" checked={data.selectedOptions?.includes(option.code) ?? false} onChange={() => toggleOption(option.code)} /><span>{option.label}</span></label>)}</div></section> : null}
                <section className="package-option-group service-length-option"><h3>Service</h3>{standardServiceHours === 4 ? <label className={data.extendToEightHours ? "selected" : ""}><input type="checkbox" checked={Boolean(data.extendToEightHours)} onChange={(event) => setData((current) => ({ ...current, extendToEightHours: event.target.checked }))} /><span><strong>Extend to 8 hours</strong><small>Full-day service.</small></span></label> : <p>Up to 8 hours included.</p>}</section>
              </div> : null}
            </div>
            <div className="package-event-strip">
              <div><small>Cups</small><strong>{data.totalCups}</strong></div>
              <div><small>Dates</small><strong>{data.serviceDates.length}</strong></div>
              <div><small>Event</small><strong title={data.location}>{data.location}</strong></div>
            </div>
            {previewError ? <div className="warn-summary package-validation-message">{previewError}</div> : null}
            <footer className="package-total-bar"><div><small>Total</small><strong>{previewLoading ? "Updating..." : preview ? formatMoney(preview.finalTotal) : "—"}</strong><span>{data.discountPercent ? "FIRST applied" : "Bundled quotation"}</span></div><Button type="button" onClick={() => void submit()} disabled={!preview || previewLoading || submitting}>{submitting ? "Submitting..." : "Submit Quotation"}</Button></footer>
          </section> : <section className="package-detail-panel package-detail-empty" aria-live="polite"><div><span className="package-empty-mark" aria-hidden="true">→</span><h2>Select a package</h2><p>Details and total will appear here.</p></div><footer className="package-total-bar"><div><small>Total</small><strong>—</strong></div><Button type="button" disabled>Choose a package</Button></footer></section>}
        </div>
        {error ? <p className="error">{error}</p> : null}
        <div className="hc-nav-row package-back-row"><Button type="button" variant="secondary" onClick={() => setStep(0)}>Back</Button><button type="button" className="start-over-link" onClick={resetForm}>Start over</button></div>
      </div>}
    </Card>

    <div className="print-document quotation-print-document"><div className="invoice-card quotation-card package-quotation-document" id="quotationPreview">
      <div className="invoice-header"><div><div className="invoice-title">QUOTATION</div><div className="invoice-meta"><div><span>Quotation No</span><strong>{activeQuotationNo}</strong></div><div><span>Quote Date</span><strong>{formatCompactDate(new Date())}</strong></div><div><span>Status</span><strong>Preview</strong></div></div></div><div className="invoice-brand">Hour Coffee</div></div>
      <div className="invoice-two-col"><div><span className="label-small">Prepared By</span><strong>HOUR COFFEE</strong><p>21, Jalan SS22/40, Damansara Jaya, 47400, Petaling Jaya, Selangor</p><p>contact@hourcoffee.com.my</p></div><div><span className="label-small">Prepared For</span><strong>{data.customer.name}</strong><p>{data.customer.phone}</p><p>{data.customer.email}</p></div></div>
      <div className="invoice-section"><h3>Event Summary</h3><div className="invoice-summary-grid"><div><span>Event address</span><strong>{data.location}</strong></div><div><span>Total cups</span><strong>{data.totalCups}</strong></div><div><span>Service dates</span><strong>{data.serviceDates.map((date) => displayDate(date.serviceDate)).join(", ")}</strong></div>{data.notes ? <div><span>Notes</span><strong>{data.notes}</strong></div> : null}</div></div>
      <div className="invoice-section"><h3>Selected Package</h3><strong>{selectedPackage?.name ?? "—"}</strong><p>{selectedPackage?.shortDescription}</p><ul>{preview?.selectedItems.map((item) => <li key={item}>{item}</li>)}</ul></div>
      <div className="invoice-totals"><div className="final"><span>Total RM</span><strong>{formatMoney(preview?.finalTotal ?? 0)}</strong></div></div><footer>Prepared by Hour Coffee.</footer>
    </div></div>
  </main>;
}
