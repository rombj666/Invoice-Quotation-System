"use client";

import { useEffect, useMemo, useState } from "react";
import { getMinimumSelectableDate, toLocalIsoDate } from "../../lib/calendar";
import { openCustomerQuotationWhatsApp } from "../../lib/contact";
import { formatDateLabel, formatMoney } from "../../lib/formatters";
import { loadQuotationPackages } from "../../lib/packages";
import { getQuotationBaristaPricing } from "../../lib/pricing";
import { trackQuotationAnalytics } from "../../lib/quotation-analytics";
import { previewQuotationPricing } from "../../lib/quotation-storage";
import type { CartStyle, FixedPackageDisplay, PackageCode, PackageOptionCode, QuotationData, QuotationPricingPreview, ServiceDate, ServiceDurationMode } from "../../types/quotation";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { TextArea, TextInput } from "../common/FormField";
import { ProgressHeader } from "./ProgressHeader";
import { QuotationDatePicker } from "./QuotationDatePicker";

const totalSteps = 2;
const draftStorageKey = "hourCoffeeQuotationDraft";
export const submittedQuotationStorageKey = "hourCoffeeLastSubmittedQuotation";

const PACKAGE_ORDER: Record<PackageCode, number> = {
  EXHIBITOR: 0,
  CONFERENCE: 1,
  BRAND_LAUNCH: 2,
  CUSTOMIZE: 3
};

const PACKAGE_ICONS: Record<PackageCode, string> = {
  EXHIBITOR: "01",
  CONFERENCE: "02",
  BRAND_LAUNCH: "03",
  CUSTOMIZE: "+"
};

const CART_DESCRIPTIONS: Record<CartStyle, string> = {
  NO_CART: "Service only",
  EQUIPMENT_CART: "Classic service cart",
  FOAM_BOARD_DISPLAY_CART: "Branded display cart"
};

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

function getCustomizeDefaultCart(item: FixedPackageDisplay): CartStyle | undefined {
  return item.availableCartStyles.find((cart) => cart.code === "NO_CART")?.code
    ?? item.defaultCart
    ?? item.availableCartStyles[0]?.code;
}

export function QuotationShell() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<QuotationData>(initialQuotation);
  const [packages, setPackages] = useState<FixedPackageDisplay[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<QuotationPricingPreview | null>(null);
  const [packageTotals, setPackageTotals] = useState<Partial<Record<PackageCode, number>>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const minimumDate = useMemo(() => toLocalIsoDate(getMinimumSelectableDate()), []);

  const displayPackages = useMemo(
    () => [...packages].sort((a, b) => PACKAGE_ORDER[a.code] - PACKAGE_ORDER[b.code]),
    [packages]
  );
  const selectedPackage = useMemo(
    () => packages.find((item) => item.code === data.packageCode),
    [packages, data.packageCode]
  );
  const sortedServiceDates = useMemo(
    () => [...data.serviceDates].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate)),
    [data.serviceDates]
  );
  const selectedPreview = preview?.packageDisplay.code === data.packageCode ? preview : null;
  const discountApplied = data.discountCode.trim().toUpperCase() === "FIRST";
  const selectedDuration: ServiceDurationMode = data.serviceDuration === "FULL_DAY" ? "FULL_DAY" : "HALF_DAY";
  const baristaPricing = getQuotationBaristaPricing(Number(data.totalCups), selectedDuration);

  useEffect(() => {
    trackQuotationAnalytics("OPEN", 0);
    const savedDraft = window.localStorage.getItem(draftStorageKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as { version?: number; step?: number; data?: QuotationData };
        if (parsed.version === 7 && parsed.data?.customer && Array.isArray(parsed.data.serviceDates)) {
          const savedDuration = parsed.data.serviceDuration === "FULL_DAY" || parsed.data.serviceDuration === "HALF_DAY"
            ? parsed.data.serviceDuration
            : parsed.data.serviceDates[0]?.durationMode === "FULL_DAY" ? "FULL_DAY" : "HALF_DAY";
          setData({ ...parsed.data, serviceDuration: savedDuration });
          setStep(parsed.step === 1 ? 1 : 0);
        }
      } catch {
        window.localStorage.removeItem(draftStorageKey);
      }
    }

    loadQuotationPackages()
      .then(setPackages)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load packages."))
      .finally(() => { setPackagesLoading(false); setReady(true); });
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ version: 7, step, data }));
  }, [data, ready, step]);

  useEffect(() => {
    if (!selectedPackage) return;
    setData((current) => {
      if (current.packageCode !== selectedPackage.code) return current;
      if (selectedPackage.code === "CUSTOMIZE") {
        const hasValidCart = selectedPackage.availableCartStyles.some((cart) => cart.code === current.cartStyle);
        if (hasValidCart && !current.extendToEightHours) return current;
        return { ...current, cartStyle: hasValidCart ? current.cartStyle : getCustomizeDefaultCart(selectedPackage), extendToEightHours: false };
      }
      if (selectedPackage.code === "EXHIBITOR") {
        const selectedOptions = (current.selectedOptions ?? []).filter((option) => selectedPackage.availableOptions.some((available) => available.code === option));
        const isAlreadyExhibitor = selectedOptions.length === (current.selectedOptions?.length ?? 0) && !current.extendToEightHours && !current.cartStyle;
        return isAlreadyExhibitor ? current : { ...current, selectedOptions, extendToEightHours: false, cartStyle: undefined };
      }
      const isAlreadyFixed = !(current.selectedOptions?.length) && !current.extendToEightHours && !current.cartStyle;
      return isAlreadyFixed ? current : { ...current, selectedOptions: [], extendToEightHours: false, cartStyle: undefined };
    });
  }, [selectedPackage]);

  useEffect(() => {
    if (step !== 1 || !data.packageCode) {
      setPreview(null);
      setPreviewLoading(false);
      setPreviewError("");
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const timer = window.setTimeout(() => {
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
  }, [data.cartStyle, data.discountCode, data.extendToEightHours, data.packageCode, data.selectedOptions, data.serviceDates, data.serviceDuration, data.totalCups, step]);

  useEffect(() => {
    if (step !== 1 || !displayPackages.length) return;
    let cancelled = false;
    Promise.all(displayPackages.map(async (item) => {
      const cartStyle = item.code === "CUSTOMIZE" ? getCustomizeDefaultCart(item) : undefined;
      const result = await previewQuotationPricing({
        ...data,
        packageCode: item.code,
        selectedPackageId: item.id,
        cartStyle,
        selectedOptions: []
      });
      return [item.code, result.finalTotal] as const;
    }))
      .then((totals) => { if (!cancelled) setPackageTotals(Object.fromEntries(totals)); })
      .catch(() => { if (!cancelled) setPackageTotals({}); });
    return () => { cancelled = true; };
  }, [data.discountCode, data.serviceDates, data.serviceDuration, data.totalCups, displayPackages, step]);

  function setCustomer(field: "name" | "phone" | "email", value: string) {
    setData((current) => ({ ...current, customer: { ...current.customer, [field]: value } }));
  }

  function setAddress(value: string) {
    setData((current) => ({ ...current, location: value, fullAddress: value, customer: { ...current.customer, billingAddress: value } }));
  }

  function setServiceDates(serviceDates: ServiceDate[]) {
    setData((current) => ({ ...current, serviceDates, selectedDates: serviceDates.map((date) => date.serviceDate) }));
    setError("");
  }

  function setTotalCups(value: string) {
    if (value && !/^\d+$/.test(value)) return;
    setData((current) => ({ ...current, totalCups: value === "" ? undefined : Number(value) }));
    setError("");
  }

  function setServiceDuration(serviceDuration: ServiceDurationMode) {
    setData((current) => ({ ...current, serviceDuration }));
    setError("");
  }

  function validateBasicInfo() {
    if (!Number.isInteger(data.totalCups) || Number(data.totalCups) < 50) return setError("Minimum order is 50 cups for both Half Day and Full Day.");
    if (!data.serviceDates.length) return setError("Choose at least one event date.");
    if (data.serviceDates.some((date) => !date.serviceDate || date.serviceDate < minimumDate)) return setError("One or more selected event dates are unavailable.");
    if (new Set(data.serviceDates.map((date) => date.serviceDate)).size !== data.serviceDates.length) return setError("Each event date can only be selected once.");
    setData((current) => ({ ...current, discountPercent: discountApplied ? 5 : 0 }));
    setError("");
    setStep(1);
    trackQuotationAnalytics("ACTIVITY", 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectPackage(item: FixedPackageDisplay) {
    setPreview(null);
    setPreviewLoading(true);
    setData((current) => {
      const isCustomize = item.code === "CUSTOMIZE";
      const canSelectOptions = isCustomize || item.code === "EXHIBITOR";
      const selectedOptions = canSelectOptions
        ? item.code === "EXHIBITOR" && current.packageCode !== "EXHIBITOR"
          ? []
          : (current.selectedOptions ?? []).filter((option) => item.availableOptions.some((available) => available.code === option))
        : [];
      const cartStyle = isCustomize && current.cartStyle && item.availableCartStyles.some((available) => available.code === current.cartStyle)
        ? current.cartStyle
        : isCustomize ? getCustomizeDefaultCart(item) : undefined;
      return { ...current, packageCode: item.code, selectedPackageId: item.id, selectedOptions, cartStyle, extendToEightHours: false };
    });
    setError("");
  }

  function toggleOption(option: PackageOptionCode) {
    setPreviewLoading(true);
    setData((current) => {
      const selected = current.selectedOptions ?? [];
      return { ...current, selectedOptions: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] };
    });
  }

  function packagePrice(item: FixedPackageDisplay): number | undefined {
    if (item.code === data.packageCode && selectedPreview) return selectedPreview.finalTotal;
    return packageTotals[item.code];
  }

  function continueToWhatsApp() {
    if (!selectedPackage) return setError("Choose a package first.");
    if (!selectedPreview || previewLoading || previewError) return setError(previewError || "Wait for the total to finish updating.");
    setError("");
    openCustomerQuotationWhatsApp({ quotation: data, packageName: selectedPackage.name, estimatedTotal: selectedPreview.finalTotal });
  }

  return <main className="hc-page quotation-workspace">
    <Card className="quotation-flow-card">
      <ProgressHeader currentStep={step} totalSteps={totalSteps} steps={["Basic Info & Event Details", "Choose, Review & Submit"]} />

      {step === 0 ? <div className="quotation-basic-step">
        <div className="step-intro"><p className="quotation-kicker">Your event, made memorable</p><h1>Basic Info &amp; Event Details</h1><p className="step-copy">Set your event details and dates.</p></div>
        <div className="basic-info-grid quotation-basic-grid">
          <TextInput className="basic-info-name" label="Customer Full Name" autoComplete="name" value={data.customer.name} onChange={(event) => setCustomer("name", event.target.value)} />
          <TextInput label="Phone Number" type="tel" autoComplete="tel" value={data.customer.phone} onChange={(event) => setCustomer("phone", event.target.value)} />
          <TextInput label="Email Address" type="email" autoComplete="email" value={data.customer.email} onChange={(event) => setCustomer("email", event.target.value)} />
          <TextArea className="basic-info-address" label="Event Address" rows={3} value={data.location} onChange={(event) => setAddress(event.target.value)} />
          <TextInput label="Discount Code" value={data.discountCode} onChange={(event) => setData((current) => ({ ...current, discountCode: event.target.value }))} hint={discountApplied ? "FIRST applied — 5% off" : undefined} />
        </div>

        <QuotationDatePicker serviceDates={data.serviceDates} minimumDate={minimumDate} onChange={setServiceDates} sideContent={<div className="quotation-event-controls">
          <label className="quotation-cups-control">
            <span>Total cups</span>
            <input type="text" inputMode="numeric" pattern="[0-9]*" required value={data.totalCups ?? ""} onChange={(event) => setTotalCups(event.target.value)} />
            <small>Minimum 50 cups.</small>
          </label>
          <fieldset className="quotation-duration-control">
            <legend>Service duration</legend>
            <div>
              <label className={selectedDuration === "HALF_DAY" ? "active" : ""}>
                <input type="radio" name="service-duration" checked={selectedDuration === "HALF_DAY"} onChange={() => setServiceDuration("HALF_DAY")} />
                <span><strong>Half Day</strong><small>Up to 4 hours</small></span>
              </label>
              <label className={selectedDuration === "FULL_DAY" ? "active" : ""}>
                <input type="radio" name="service-duration" checked={selectedDuration === "FULL_DAY"} onChange={() => setServiceDuration("FULL_DAY")} />
                <span><strong>Full Day</strong><small>More than 4 hours</small></span>
              </label>
            </div>
          </fieldset>
        </div>} />

        <TextArea label="Notes" rows={3} placeholder="Preferences or special requests" value={data.notes ?? ""} onChange={(event) => setData((current) => ({ ...current, notes: event.target.value }))} />
        {error ? <p className="error">{error}</p> : null}
        <div className="hc-nav-row quotation-primary-action"><Button type="button" onClick={validateBasicInfo}>Continue to Packages</Button></div>
      </div> : <div className="quotation-package-step">
        <div className="step-intro package-step-intro"><div><p className="quotation-kicker">Choose your service</p><h1>Packages</h1><p className="step-copy">Compare, select and review.</p></div><button type="button" onClick={() => setStep(0)}>← Back</button></div>
        {packagesLoading ? <div className="package-loading">Loading packages...</div> : null}

        <div className="package-column-grid" role="radiogroup" aria-label="Quotation packages">
          {displayPackages.map((item) => {
            const selected = item.code === data.packageCode;
            const isCustomize = item.code === "CUSTOMIZE";
            const displayedPrice = packagePrice(item);
            return <article
              className={`package-column-card ${selected ? "selected" : ""} ${isCustomize ? "custom-package-column" : ""} ${item.code === "BRAND_LAUNCH" ? "most-picked" : ""}`}
              key={item.code}
              role="radio"
              aria-checked={selected}
              tabIndex={0}
              onClick={() => selectPackage(item)}
              onKeyDown={(event) => {
                if (event.currentTarget !== event.target) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectPackage(item);
                }
              }}
            >
              {item.code === "BRAND_LAUNCH" ? <span className="package-most-picked-badge">Most Picked</span> : null}
              <header className="package-column-heading">
                <span className="package-column-index">{PACKAGE_ICONS[item.code]}</span>
                <span className="package-column-kind">{isCustomize ? "Flexible" : "Fixed"}</span>
                <h2>{item.name}</h2>
                <p>{item.shortDescription}</p>
              </header>
              <div className="package-column-price">
                <small>Estimated total</small>
                <strong>{selected && previewLoading ? "…" : displayedPrice === undefined ? "—" : formatMoney(displayedPrice)}</strong>
              </div>
              <section className="package-column-inclusions" aria-label={`${item.name} inclusions`}>
                <h3>Includes</h3>
                <ul>{item.includedItems.map((included) => <li key={included}><span>✓</span>{included}</li>)}</ul>
              </section>

              {item.code === "EXHIBITOR" && selected && item.availableOptions.length ? <div className="package-column-custom-controls" key={`${item.code}-controls`} onClick={(event) => event.stopPropagation()}>
                <fieldset><legend>Optional add-on</legend>{item.availableOptions.map((option) => <label className={data.selectedOptions?.includes(option.code) ? "selected" : ""} key={option.code}>
                  <input type="checkbox" checked={data.selectedOptions?.includes(option.code) ?? false} onChange={() => toggleOption(option.code)} />
                  <span><strong>{option.label}</strong><small>+ RM200</small></span>
                </label>)}</fieldset>
              </div> : null}

              {isCustomize && selected ? <div className="package-column-custom-controls" key={`${item.code}-controls`} onClick={(event) => event.stopPropagation()}>
                {item.availableCartStyles.length ? <fieldset><legend>Cart</legend>{item.availableCartStyles.map((cart) => <label className={data.cartStyle === cart.code ? "selected" : ""} key={cart.code}>
                  <input type="radio" name="cart-style" checked={data.cartStyle === cart.code} onChange={() => setData((current) => ({ ...current, cartStyle: cart.code }))} />
                  <span><strong>{cart.label}</strong><small>{CART_DESCRIPTIONS[cart.code]}</small></span>
                </label>)}</fieldset> : null}
                {item.availableOptions.length ? <fieldset><legend>Extras</legend>{item.availableOptions.map((option) => <label className={data.selectedOptions?.includes(option.code) ? "selected" : ""} key={option.code}>
                  <input type="checkbox" checked={data.selectedOptions?.includes(option.code) ?? false} onChange={() => toggleOption(option.code)} />
                  <span>{option.label}</span>
                </label>)}</fieldset> : null}
              </div> : null}

              <button className="package-column-action" type="button" onClick={(event) => { event.stopPropagation(); selectPackage(item); }}>
                {selected ? <><span>✓</span> Selected</> : "Choose package"}
              </button>
            </article>;
          })}
        </div>

        <section className="quotation-summary-card" aria-live="polite">
          <div className="quotation-summary-heading"><span>Review</span><h2>Your quotation</h2></div>
          <dl className="quotation-summary-row">
            <div><dt>Cups</dt><dd>{data.totalCups ?? "—"}</dd></div>
            <div><dt>Duration</dt><dd>{selectedDuration === "FULL_DAY" ? "Full Day" : "Half Day"}</dd></div>
            <div><dt>Baristas</dt><dd>{baristaPricing.requiredBaristas || "—"}</dd></div>
            <div><dt>Package</dt><dd>{selectedPackage?.name ?? "—"}</dd></div>
            <div className="quotation-summary-total"><dt>Total</dt><dd>{previewLoading ? "Updating…" : selectedPreview ? formatMoney(selectedPreview.finalTotal) : "—"}</dd>{discountApplied ? <small>FIRST · 5% off</small> : null}</div>
          </dl>
          <div className="quotation-summary-details">
            <div className="quotation-summary-detail">
              <span>Event dates</span>
              {sortedServiceDates.length ? <div className="quotation-summary-date-list">{sortedServiceDates.map((date) => <strong key={date.id}>{formatDateLabel(date.serviceDate)}</strong>)}</div> : <p>—</p>}
            </div>
            <div className="quotation-summary-detail">
              <span>Event address</span>
              <p>{data.location.trim() || "—"}</p>
            </div>
          </div>
        </section>
        <div className="quotation-submit-action"><Button type="button" onClick={continueToWhatsApp} disabled={!selectedPackage || !selectedPreview || previewLoading}>Submit</Button></div>
        {previewError ? <p className="error">{previewError}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>}
    </Card>
  </main>;
}
