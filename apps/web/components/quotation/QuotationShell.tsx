"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerDetails, DrinkOrderByDate, PreviousQuotationSummary, QuotationData, ServiceDate, ServiceDurationMode } from "../../types/quotation";
import { hasText, isValidEmail, isValidMalaysiaPhone } from "../../lib/validators";
import { calculatePricing } from "../../lib/pricing";
import { findPreviousQuotations, getNextQuotationNo, loadPreviousQuotationSummary } from "../../lib/quotation-storage";
import { Card } from "../common/Card";
import { AddOnsStep } from "./AddOnsStep";
import { ContactDetailsStep } from "./ContactDetailsStep";
import { DrinkPreferencesStep } from "./DrinkPreferencesStep";
import { PlanEventStep } from "./PlanEventStep";
import { ProgressHeader } from "./ProgressHeader";
import { QuotationReviewStep } from "./QuotationReviewStep";
import { PreviousQuotationsPanel } from "./PreviousQuotationsPanel";
import { resetQuotationAnalyticsSession, trackQuotationAnalytics } from "../../lib/quotation-analytics";

const totalSteps = 3;
export const submittedQuotationStorageKey = "hourCoffeeLastSubmittedQuotation";
const quotationDraftStorageKey = "hourCoffeeQuotationDraft";
const quotationSummaryIdentityKey = "hourCoffeeQuotationSummaryIdentity";

function identityKey(customer: Pick<CustomerDetails, "name" | "phone" | "email">) {
  return `${customer.name.trim().toLowerCase()}|${customer.phone.replace(/\D/g, "")}|${customer.email.trim().toLowerCase()}`;
}

const emptyQuotation: QuotationData = {
  quotationNo: "Q00001",
  serviceDates: [],
  totalCups: 50,
  serviceDuration: "HALF_DAY",
  location: "",
  fullAddress: "",
  eventType: "",
  customEventType: "",
  drinkOrders: {},
  drinkDistributionModeByDate: {},
  excludedBeverageIdsByDate: {},
  beverageSnapshots: {},
  sameDrinkDistribution: false,
  letHourCoffeeDecideDrinks: true,
  masterDrinkDate: undefined,
  selectedAddons: [],
  hasCupSleeves: false,
  hasCupStickers: false,
  customizationOptions: {
    cart: { mode: "same", designCount: 1 },
    sticker: { mode: "same", designCount: 1 },
    sleeve: { mode: "same", designCount: 1 }
  },
  customer: {
    name: "",
    phone: "",
    email: "",
    companyName: "",
    companyRegNo: "",
    billingAddress: ""
  },
  discountCode: "",
  discountPercent: 0,
  linkExpiryDays: 7
};

function ensureDrinkOrders(data: QuotationData): QuotationData {
  const nextOrders: DrinkOrderByDate = { ...data.drinkOrders };
  data.serviceDates.forEach((date) => {
    if (!nextOrders[date.id]) {
      nextOrders[date.id] = {};
    }
  });
  return { ...data, drinkOrders: nextOrders, drinkDistributionModeByDate: Object.fromEntries(data.serviceDates.map((date) => [date.id, "HOUR_COFFEE_DECIDES"])), excludedBeverageIdsByDate: Object.fromEntries(data.serviceDates.map((date) => [date.id, data.excludedBeverageIdsByDate?.[date.id] ?? []])), letHourCoffeeDecideDrinks: true };
}

export function QuotationShell() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [data, setData] = useState<QuotationData>(emptyQuotation);
  const [draftReady, setDraftReady] = useState(false);
  const [quotationView, setQuotationView] = useState<"editor" | "history" | "summary">("editor");
  const [previousQuotations, setPreviousQuotations] = useState<PreviousQuotationSummary[]>([]);
  const [summaryQuotation, setSummaryQuotation] = useState<QuotationData | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [isCheckingHistory, setIsCheckingHistory] = useState(false);
  const [drinksValid, setDrinksValid] = useState(false);
  const [lookedUpIdentity, setLookedUpIdentity] = useState("");
  const analyticsStarted = useRef(false);
  const analyticsLastTrackedAt = useRef(0);

  useEffect(() => {
    trackQuotationAnalytics("OPEN", 0);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    if (step > 0) analyticsStarted.current = true;
    if (!analyticsStarted.current) return;
    trackQuotationAnalytics("ACTIVITY", step);
    analyticsLastTrackedAt.current = Date.now();
  }, [draftReady, step]);

  function markAnalyticsStarted() {
    const now = Date.now();
    if (!analyticsStarted.current) {
      analyticsStarted.current = true;
      analyticsLastTrackedAt.current = now;
      trackQuotationAnalytics("START", step);
      return;
    }
    if (now - analyticsLastTrackedAt.current >= 30_000) {
      analyticsLastTrackedAt.current = now;
      trackQuotationAnalytics("ACTIVITY", step);
    }
  }

  useEffect(() => {
    const summaryQuotationNo = new URLSearchParams(window.location.search).get("summary");
    const savedSubmission = window.localStorage.getItem(submittedQuotationStorageKey);
    if (!summaryQuotationNo && savedSubmission) {
      try {
        const parsed = JSON.parse(savedSubmission) as { quotationNo?: string; status?: string };
        if (parsed.quotationNo && parsed.status === "submitted") {
          router.replace(`/quotation/submitted?quotationNo=${encodeURIComponent(parsed.quotationNo)}`);
          return;
        }
      } catch {
        window.localStorage.removeItem(submittedQuotationStorageKey);
      }
    }
    const savedDraft = window.localStorage.getItem(quotationDraftStorageKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft) as { version?: number; step?: number; currentStep?: number; data?: Partial<QuotationData> } & Partial<QuotationData>;
        const draftData = parsed.data ?? parsed;
        if (draftData.customer && Array.isArray(draftData.serviceDates)) {
          const restored = {
            ...emptyQuotation,
            ...draftData,
            customer: { ...emptyQuotation.customer, ...draftData.customer },
            customizationOptions: { ...emptyQuotation.customizationOptions, ...draftData.customizationOptions }
          } as QuotationData;
          if (parsed.version !== 3 && parsed.version !== 4 && hasText(restored.fullAddress)) {
            restored.location = restored.fullAddress;
            restored.fullAddress = "";
          }
          if (parsed.version !== 5) {
            const restoredTotalCups = Number(restored.totalCups) || restored.serviceDates.reduce((sum, date) => sum + Number(date.cups || 0), 0) || 50;
            const restoredDuration = restored.serviceDuration ?? restored.serviceDates[0]?.durationMode ?? "HALF_DAY";
            restored.totalCups = restoredTotalCups;
            restored.serviceDuration = restoredDuration;
            restored.serviceDates = restored.serviceDates.map((date) => ({
              ...date,
              cups: restoredTotalCups,
              durationMode: restoredDuration,
              startTime: "09:00",
              endTime: restoredDuration === "FULL_DAY" ? "17:00" : "13:00"
            }));
          }
          const contactIsValid = hasText(restored.customer.name) && isValidMalaysiaPhone(restored.customer.phone) && isValidEmail(restored.customer.email);
          const legacyStep = Number(parsed.step ?? parsed.currentStep ?? 0);
          const previousFlowStep = parsed.version === 2 ? legacyStep : contactIsValid ? legacyStep + 1 : 0;
          const restoredStep = parsed.version === 4 || parsed.version === 5
            ? legacyStep
            : previousFlowStep <= 0 ? 0 : 1;
          setData(restored);
          setStep(hasText(restored.location) ? Math.min(totalSteps - 1, Math.max(0, restoredStep)) : 0);
          setDraftReady(true);
          if (summaryQuotationNo) void openPreviousQuotation(summaryQuotationNo, restored.customer, false);
          return;
        }
      } catch {
        window.localStorage.removeItem(quotationDraftStorageKey);
      }
    }
    if (summaryQuotationNo) {
      const savedIdentity = window.sessionStorage.getItem(quotationSummaryIdentityKey);
      if (savedIdentity) {
        try {
          const identity = JSON.parse(savedIdentity) as Pick<CustomerDetails, "name" | "phone" | "email">;
          setData((current) => ({ ...current, customer: { ...current.customer, ...identity } }));
          setDraftReady(true);
          void openPreviousQuotation(summaryQuotationNo, { ...emptyQuotation.customer, ...identity }, false);
          return;
        } catch {
          window.sessionStorage.removeItem(quotationSummaryIdentityKey);
        }
      }
      setHistoryError("Enter your contact details again to view this quotation.");
      router.replace("/quotation");
    }
    getNextQuotationNo()
      .then((quotationNo) => setData((current) => ({ ...current, quotationNo })))
      .catch(() => setError("Unable to load the next quotation number. Please check the API connection."))
      .finally(() => setDraftReady(true));
  }, [router]);

  useEffect(() => {
    if (!draftReady) return;
    window.localStorage.setItem(quotationDraftStorageKey, JSON.stringify({ version: 5, step, data }));
  }, [data, draftReady, step]);

  function next() {
    setError("");
    markAnalyticsStarted();
    setStep((current) => Math.min(totalSteps - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setError("");
    setStep((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validatePlanEvent() {
    if (!data.serviceDates.length) return setError("Please add at least one service date.");
    if (!Number.isInteger(data.totalCups) || Number(data.totalCups) < 50) return setError("Minimum order is 50 cups.");
    if (data.serviceDuration !== "HALF_DAY" && data.serviceDuration !== "FULL_DAY") return setError("Choose Half Day or Full Day service duration.");
    if (!validateDrinks()) return;
    setData(ensureDrinkOrders(data));
    next();
  }

  function updateServiceDates(serviceDates: ServiceDate[]) {
    const selectedIds = new Set(serviceDates.map((date) => date.id));
    setData((current) => {
      const drinkOrders = Object.fromEntries(Object.entries(current.drinkOrders).filter(([dateId]) => selectedIds.has(dateId))) as DrinkOrderByDate;
      const drinkDistributionModeByDate = Object.fromEntries(Object.entries(current.drinkDistributionModeByDate ?? {}).filter(([dateId]) => selectedIds.has(dateId)));
      const excludedBeverageIdsByDate = Object.fromEntries(Object.entries(current.excludedBeverageIdsByDate ?? {}).filter(([dateId]) => selectedIds.has(dateId)));
      const duration = current.serviceDuration ?? "HALF_DAY";
      const normalizedDates = serviceDates.map((date) => ({
        ...date,
        cups: current.totalCups ?? 50,
        durationMode: duration,
        startTime: "09:00",
        endTime: duration === "FULL_DAY" ? "17:00" : "13:00"
      }));
      return { ...current, serviceDates: normalizedDates, drinkOrders, drinkDistributionModeByDate, excludedBeverageIdsByDate };
    });
  }

  function updateTotalCups(totalCups: number) {
    setData((current) => ({
      ...current,
      totalCups,
      serviceDates: current.serviceDates.map((date) => ({ ...date, cups: totalCups }))
    }));
  }

  function updateServiceDuration(serviceDuration: ServiceDurationMode) {
    setData((current) => ({
      ...current,
      serviceDuration,
      serviceDates: current.serviceDates.map((date) => ({
        ...date,
        durationMode: serviceDuration,
        startTime: "09:00",
        endTime: serviceDuration === "FULL_DAY" ? "17:00" : "13:00"
      }))
    }));
  }

  function validateDrinks(): boolean {
    for (const date of data.serviceDates) {
      const excluded = new Set(data.excludedBeverageIdsByDate?.[date.id] ?? []);
      const availableIds = Object.keys(data.beverageSnapshots ?? {});
      if (availableIds.length && availableIds.every((id) => excluded.has(id))) {
        setError("Please keep at least one drink available for your event.");
        return false;
      }
    }
    setError("");
    return true;
  }

  async function validateContact() {
    const customer = data.customer;
    if (!hasText(customer.name)) return setError("Customer name is required.");
    if (!isValidMalaysiaPhone(customer.phone)) return setError("Valid phone number is required.");
    if (!isValidEmail(customer.email)) return setError("Valid email is required.");
    if (!hasText(data.location)) return setError("Event address is required.");
    const discountCode = data.discountCode.trim().toUpperCase();
    if (discountCode && discountCode !== "FIRST") return setError("Invalid discount code.");
    const normalizedCustomer = { ...customer, name: customer.name.trim(), email: customer.email.trim() };
    setData({ ...data, location: data.location.trim(), customer: normalizedCustomer, discountCode, discountPercent: discountCode === "FIRST" ? 5 : 0 });
    setError("");
    setIsCheckingHistory(true);
    try {
      const result = await findPreviousQuotations({
        name: normalizedCustomer.name,
        phone: normalizedCustomer.phone,
        email: normalizedCustomer.email
      });
      setLookedUpIdentity(identityKey(normalizedCustomer));
      if (result.quotations.length) {
        setPreviousQuotations(result.quotations);
        setQuotationView("history");
        setHistoryError("");
        return;
      }
      next();
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Unable to check previous quotations. Please try again.");
    } finally {
      setIsCheckingHistory(false);
    }
  }

  function updateContactData(nextData: QuotationData) {
    setError("");
    if (lookedUpIdentity && identityKey(nextData.customer) !== lookedUpIdentity) {
      setPreviousQuotations([]);
      setSummaryQuotation(null);
      setQuotationView("editor");
      setHistoryError("");
      setLookedUpIdentity("");
    }
    setData(nextData);
  }

  async function openPreviousQuotation(
    quotationNo: string,
    customer: CustomerDetails,
    updateUrl = true
  ) {
    setIsCheckingHistory(true);
    setHistoryError("");
    try {
      const identity = { name: customer.name, phone: customer.phone, email: customer.email };
      const result = await loadPreviousQuotationSummary(quotationNo, identity);
      if (result.access === "INVOICE_STARTED") {
        const history = await findPreviousQuotations(identity);
        setPreviousQuotations(history.quotations);
        setQuotationView("history");
        setHistoryError("This quotation has already proceeded to the invoice process.");
        if (updateUrl) router.replace("/quotation");
        return;
      }
      if (result.access === "NOT_FOUND") {
        setQuotationView("history");
        setHistoryError("This quotation could not be verified with the current contact details.");
        if (updateUrl) router.replace("/quotation");
        return;
      }
      setSummaryQuotation(result.quotation);
      setQuotationView("summary");
      window.sessionStorage.setItem(quotationSummaryIdentityKey, JSON.stringify(identity));
      if (updateUrl) router.replace(`/quotation?summary=${encodeURIComponent(quotationNo)}`);
    } catch (lookupError) {
      setHistoryError(lookupError instanceof Error ? lookupError.message : "Unable to load this quotation.");
    } finally {
      setIsCheckingHistory(false);
    }
  }

  function createAnotherQuotation() {
    const customer = data.customer;
    const preservedContact = {
      ...emptyQuotation.customer,
      name: customer.name,
      phone: customer.phone,
      email: customer.email
    };
    window.localStorage.removeItem(submittedQuotationStorageKey);
    window.sessionStorage.removeItem(quotationSummaryIdentityKey);
    resetQuotationAnalyticsSession();
    trackQuotationAnalytics("START", 0);
    analyticsStarted.current = true;
    setData({ ...emptyQuotation, customer: preservedContact });
    setPreviousQuotations([]);
    setSummaryQuotation(null);
    setQuotationView("editor");
    setHistoryError("");
    setLookedUpIdentity("");
    setError("");
    setStep(0);
    router.replace("/quotation");
    getNextQuotationNo()
      .then((quotationNo) => setData((current) => ({ ...current, quotationNo })))
      .catch(() => setError("Unable to load the next quotation number. Please check the API connection."));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (quotationView === "summary" && summaryQuotation) {
    return (
      <main className="hc-page">
        <div className="team-topbar">HOUR COFFEE — QUOTATION &amp; INVOICE SYSTEM</div>
        <Card className="quotation-flow-card"><QuotationReviewStep data={summaryQuotation} readOnly onCreateAnother={createAnotherQuotation} /></Card>
      </main>
    );
  }

  if (quotationView === "history") {
    return (
      <main className="hc-page">
        <div className="team-topbar">HOUR COFFEE — QUOTATION &amp; INVOICE SYSTEM</div>
        <Card className="quotation-flow-card">
          <PreviousQuotationsPanel
            quotations={previousQuotations}
            error={historyError}
            isLoading={isCheckingHistory}
            onView={(quotationNo) => openPreviousQuotation(quotationNo, data.customer)}
            onCreateAnother={createAnotherQuotation}
          />
        </Card>
      </main>
    );
  }

  return (
    <main className="hc-page" onInputCapture={markAnalyticsStarted} onChangeCapture={markAnalyticsStarted}>
      <div className="team-topbar">HOUR COFFEE — QUOTATION &amp; INVOICE SYSTEM</div>
      <Card className="quotation-flow-card">
        <ProgressHeader currentStep={step} totalSteps={totalSteps} steps={["Basic Info", "Event Setup", "Review & Submit"]} />
        {step === 0 ? <ContactDetailsStep data={data} setData={updateContactData} onNext={validateContact} isChecking={isCheckingHistory} error={error} /> : null}
        {step === 1 ? <div className="event-setup-step">
          <div className="step-intro"><h2>Event Setup</h2><p className="step-copy">Build your event service in one place.</p></div>
          <PlanEventStep serviceDates={data.serviceDates} setServiceDates={updateServiceDates} totalCups={data.totalCups} serviceDuration={data.serviceDuration} setTotalCups={updateTotalCups} setServiceDuration={updateServiceDuration} onBack={back} onNext={validatePlanEvent} error="" pricing={calculatePricing(data)} durationModeOnly embedded />
          <DrinkPreferencesStep data={data} setData={setData} onBack={back} onNext={() => undefined} error="" embedded onValidityChange={setDrinksValid} />
          <AddOnsStep
            data={data}
            setData={setData}
            onBack={back}
            onNext={validatePlanEvent}
            embedded
            nextLabel="CONTINUE"
            nextDisabled={!drinksValid}
            submissionError={error}
          />
        </div> : null}
        {step === 2 ? <QuotationReviewStep data={data} onBack={back} /> : null}
      </Card>
    </main>
  );
}
