"use client";

import { useEffect, useState } from "react";
import type { DrinkId, DrinkOrderByDate, QuotationData, ServiceDate } from "../../types/quotation";
import { hasText, isValidEmail, isValidMalaysiaPhone } from "../../lib/validators";
import { getNextQuotationNo } from "../../lib/quotation-storage";
import { Card } from "../common/Card";
import { AddOnsStep } from "./AddOnsStep";
import { CustomerDetailsStep } from "./CustomerDetailsStep";
import { DrinkPreferencesStep } from "./DrinkPreferencesStep";
import { LocationStep } from "./LocationStep";
import { PlanEventStep } from "./PlanEventStep";
import { ProgressHeader } from "./ProgressHeader";
import { QuotationReferenceStep } from "./QuotationReferenceStep";
import { QuotationReviewStep } from "./QuotationReviewStep";

const totalSteps = 7;
const drinkIds: DrinkId[] = ["americano", "latte", "chocolate", "lemonade"];

const emptyQuotation: QuotationData = {
  quotationNo: "Q00001",
  serviceDates: [],
  location: "",
  fullAddress: "",
  eventType: "",
  customEventType: "",
  drinkOrders: {},
  sameDrinkDistribution: false,
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
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [data, setData] = useState<QuotationData>(emptyQuotation);

  useEffect(() => {
    setData((current) => ({ ...current, quotationNo: getNextQuotationNo() }));
  }, []);

  function next() {
    setError("");
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
    const drinkOrders = Object.fromEntries(Object.entries(data.drinkOrders).filter(([dateId]) => selectedIds.has(dateId))) as DrinkOrderByDate;
    setData({ ...data, serviceDates, drinkOrders });
  }

  function validateLocation() {
    if (!data.location || !data.eventType) return setError("Please fill all fields.");
    if (data.location.startsWith("Others") && !hasText(data.fullAddress)) return setError("Please enter the full event address.");
    if (data.eventType === "Others" && !hasText(data.customEventType)) return setError("Please describe the event type.");
    next();
  }

  function validateDrinks() {
    for (const date of data.serviceDates) {
      const total = drinkTotalForDate(data, date.id);
      if (total !== date.cups) return setError(`Drink quantities for ${date.serviceDate} must equal ${date.cups} cups.`);
    }
    next();
  }

  function validateCustomer() {
    const customer = data.customer;
    if (!hasText(customer.name)) return setError("Customer name is required.");
    if (!isValidMalaysiaPhone(customer.phone)) return setError("Valid phone number is required.");
    if (!isValidEmail(customer.email)) return setError("Valid email is required.");
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
    setStep(0);
    setError("");
    setData({ ...emptyQuotation, quotationNo: getNextQuotationNo() });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="hc-page">
      <div className="team-topbar">Hour Coffee - PIC Internal Tool</div>
      <Card>
        <ProgressHeader currentStep={step} totalSteps={totalSteps} />
        {step === 0 ? <PlanEventStep serviceDates={data.serviceDates} setServiceDates={updateServiceDates} onNext={validatePlanEvent} error={error} /> : null}
        {step === 1 ? <LocationStep data={data} setData={setData} onBack={back} onNext={validateLocation} error={error} /> : null}
        {step === 2 ? <DrinkPreferencesStep data={data} setData={setData} onBack={back} onNext={validateDrinks} error={error} /> : null}
        {step === 3 ? <AddOnsStep data={data} setData={setData} onBack={back} onNext={next} /> : null}
        {step === 4 ? <CustomerDetailsStep data={data} setData={setData} onBack={back} onNext={validateCustomer} error={error} /> : null}
        {step === 5 ? <QuotationReferenceStep data={data} setData={setData} onBack={back} onNext={validateReference} error={error} /> : null}
        {step === 6 ? <QuotationReviewStep data={data} onBack={back} onReset={resetQuotation} /> : null}
      </Card>
    </main>
  );
}
