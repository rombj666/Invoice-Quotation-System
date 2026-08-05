"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerDetails, DrinkId, DrinkOrderByDate, PreviousQuotationSummary, QuotationData, ServiceDate } from "../../types/quotation";
import { hasText, isValidEmail, isValidMalaysiaPhone } from "../../lib/validators";
import { calculatePricing } from "../../lib/pricing";
import { findPreviousQuotations, getNextQuotationNo, loadPreviousQuotationSummary } from "../../lib/quotation-storage";
import { Card } from "../common/Card";
import { AddOnsStep } from "./AddOnsStep";
import { ContactDetailsStep } from "./ContactDetailsStep";
import { CustomerDetailsStep } from "./CustomerDetailsStep";
import { DrinkPreferencesStep } from "./DrinkPreferencesStep";
import { LocationStep } from "./LocationStep";
import { PlanEventStep } from "./PlanEventStep";
import { ProgressHeader } from "./ProgressHeader";
import { QuotationReferenceStep } from "./QuotationReferenceStep";
import { QuotationReviewStep } from "./QuotationReviewStep";
import { PreviousQuotationsPanel } from "./PreviousQuotationsPanel";
import { resetQuotationAnalyticsSession, trackQuotationAnalytics } from "../../lib/quotation-analytics";

const totalSteps = 8;
const drinkIds: DrinkId[] = ["americano", "latte", "chocolate", "lemonade"];
export const submittedQuotationStorageKey = "hourCoffeeLastSubmittedQuotation";
const quotationDraftStorageKey = "hourCoffeeQuotationDraft";
const quotationSummaryIdentityKey = "hourCoffeeQuotationSummaryIdentity";

function identityKey(customer: Pick<CustomerDetails, "name" | "phone" | "email">) {
  return `${customer.name.trim().toLowerCase()}|${customer.phone.replace(/\D/g, "")}|${customer.email.trim().toLowerCase()}`;
}

const emptyQuotation: QuotationData = {
  quotationNo: "Q00001",
  serviceDates: [],
  location: "",
  fullAddress: "",
  eventType: "",
  customEventType: "",
  drinkOrders: {},
  sameDrinkDistribution: false,
  letHourCoffeeDecideDrinks: false,
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
      nextOrders[date.id] = {
        americano: { ice: 0, hot: 0 },
        latte: { ice: 0, hot: 0 },
        chocolate: { ice: 0, hot: 0 },
        lemonade: { ice: 0, hot: 0 }
      };
    }
  });
  return { ...data, drinkOrders: nextOrders };
}

function drinkTotalForDate(data: QuotationData, dateId: string): number {
  const order = data.drinkOrders[dateId] ?? {};
  return drinkIds.reduce((sum, drinkId) => {
    const quantity = order[drinkId] ?? { ice: 0, hot: 0 };
    return sum + quantity.ice + quantity.hot;
  }, 0);
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
          const contactIsValid = hasText(restored.customer.name) && isValidMalaysiaPhone(restored.customer.phone) && isValidEmail(restored.customer.email);
          const legacyStep = Number(parsed.step ?? parsed.currentStep ?? 0);
          const restoredStep = parsed.version === 2
            ? legacyStep
            : contactIsValid ? legacyStep + 1 : 0;
          setData(restored);
          setStep(Math.min(totalSteps - 1, Math.max(0, restoredStep)));
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
    window.localStorage.setItem(quotationDraftStorageKey, JSON.stringify({ version: 2, step, data }));
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
    for (const date of data.serviceDates) {
      if (date.cups < 50) return setError(`Minimum 50 cups for ${date.serviceDate}.`);
      if (!date.startTime || !date.endTime) return setError(`Set start and end time for ${date.serviceDate}.`);
      if (date.endTime <= date.startTime) return setError(`End time must be after start time for ${date.serviceDate}.`);
    }
    setData(ensureDrinkOrders(data));
    next();
  }

  function updateServiceDates(serviceDates: ServiceDate[]) {
    const selectedIds = new Set(serviceDates.map((date) => date.id));
    setData((current) => {
      const drinkOrders = Object.fromEntries(Object.entries(current.drinkOrders).filter(([dateId]) => selectedIds.has(dateId))) as DrinkOrderByDate;
      return { ...current, serviceDates, drinkOrders };
    });
  }

  function validateLocation() {
    if (!data.location || !data.eventType) return setError("Please fill all fields.");
    if (data.location.startsWith("Others") && !hasText(data.fullAddress)) return setError("Please enter the full event address.");
    if (data.eventType === "Others" && !hasText(data.customEventType)) return setError("Please describe the event type.");
    next();
  }

  function validateDrinks() {
    if (data.letHourCoffeeDecideDrinks) {
      next();
      return;
    }
    for (const date of data.serviceDates) {
      const total = drinkTotalForDate(data, date.id);
      if (total !== date.cups) return setError(`Drink quantities for ${date.serviceDate} must equal ${date.cups} cups.`);
    }
    next();
  }

  async function validateContact() {
    const customer = data.customer;
    if (!hasText(customer.name)) return setError("Customer name is required.");
    if (!isValidMalaysiaPhone(customer.phone)) return setError("Valid phone number is required.");
    if (!isValidEmail(customer.email)) return setError("Valid email is required.");
    const normalizedCustomer = { ...customer, name: customer.name.trim(), email: customer.email.trim() };
    setData({ ...data, customer: normalizedCustomer });
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
    trackQuotationAnalytics("START", 1);
    analyticsStarted.current = true;
    setData({ ...emptyQuotation, customer: preservedContact });
    setPreviousQuotations([]);
    setSummaryQuotation(null);
    setQuotationView("editor");
    setHistoryError("");
    setLookedUpIdentity("");
    setError("");
    setStep(1);
    router.replace("/quotation");
    getNextQuotationNo()
      .then((quotationNo) => setData((current) => ({ ...current, quotationNo })))
      .catch(() => setError("Unable to load the next quotation number. Please check the API connection."));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateCustomer() {
    const customer = data.customer;
    if (!hasText(customer.billingAddress)) return setError("Billing address is required.");
    next();
  }

  function validateReference() {
    if (!hasText(data.quotationNo)) return setError("Quotation No. is required.");
    const code = data.discountCode.trim().toUpperCase();
    if (code && code !== "FIRST") return setError("Invalid voucher code.");
    setData({ ...data, discountCode: code, discountPercent: code === "FIRST" ? 5 : 0, linkExpiryDays: 7 });
    next();
  }

  function resetQuotation() {
    window.localStorage.removeItem(submittedQuotationStorageKey);
    window.localStorage.removeItem(quotationDraftStorageKey);
    setStep(0);
    setError("");
    getNextQuotationNo()
      .then((quotationNo) => setData({ ...emptyQuotation, quotationNo }))
      .catch(() => setError("Unable to load the next quotation number. Please check the API connection."));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (quotationView === "summary" && summaryQuotation) {
    return (
      <main className="hc-page">
        <div className="team-topbar">HOUR COFFEE — QUOTATION &amp; INVOICE SYSTEM</div>
        <Card><QuotationReviewStep data={summaryQuotation} readOnly onCreateAnother={createAnotherQuotation} /></Card>
      </main>
    );
  }

  if (quotationView === "history") {
    return (
      <main className="hc-page">
        <div className="team-topbar">HOUR COFFEE — QUOTATION &amp; INVOICE SYSTEM</div>
        <Card>
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
      <Card>
        <ProgressHeader currentStep={step} totalSteps={totalSteps} />
        {step === 0 ? <ContactDetailsStep data={data} setData={updateContactData} onNext={validateContact} isChecking={isCheckingHistory} error={error} /> : null}
        {step === 1 ? <PlanEventStep serviceDates={data.serviceDates} setServiceDates={updateServiceDates} onNext={validatePlanEvent} error={error} pricing={calculatePricing(data)} /> : null}
        {step === 2 ? <LocationStep data={data} setData={setData} onBack={back} onNext={validateLocation} error={error} /> : null}
        {step === 3 ? <DrinkPreferencesStep data={data} setData={setData} onBack={back} onNext={validateDrinks} error={error} /> : null}
        {step === 4 ? <AddOnsStep data={data} setData={setData} onBack={back} onNext={next} /> : null}
        {step === 5 ? <CustomerDetailsStep data={data} setData={setData} onBack={back} onNext={validateCustomer} error={error} /> : null}
        {step === 6 ? <QuotationReferenceStep data={data} setData={setData} onBack={back} onNext={validateReference} error={error} /> : null}
        {step === 7 ? <QuotationReviewStep data={data} onBack={back} onReset={resetQuotation} /> : null}
      </Card>
    </main>
  );
}
