"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomizationByDate } from "../../types/customization";
import type { InvoiceDetails } from "../../types/invoice";
import type { DrinkId, QuotationData, ServiceDate } from "../../types/quotation";
import { getNextInvoiceNo, saveInvoiceLocally } from "../../lib/invoice-storage";
import { findQuotation as findStoredQuotation } from "../../lib/quotation-storage";
import { Card } from "../common/Card";
import { StepNavigation } from "../common/StepNavigation";
import { AddOnsStep } from "../quotation/AddOnsStep";
import { DrinkPreferencesStep } from "../quotation/DrinkPreferencesStep";
import { PlanEventStep } from "../quotation/PlanEventStep";
import { CartLogoCustomizer } from "../customization/CartLogoCustomizer";
import { CupSleeveCustomizer } from "../customization/CupSleeveCustomizer";
import { CupStickerCustomizer } from "../customization/CupStickerCustomizer";
import { EventDetailsStep } from "./EventDetailsStep";
import { AcknowledgementsStep } from "./AcknowledgementsStep";
import { InvoicePreview } from "./InvoicePreview";
import { InvoiceSuccess } from "./InvoiceSuccess";
import { ReceiptUpload } from "./ReceiptUpload";

type InvoiceStep = "review" | "acknowledgements" | "receipt" | "details" | "cart" | "sleeve" | "sticker" | "preview" | "success";
type ReviewEditStep = "dates" | "drinks" | "addons";

const drinkIds: DrinkId[] = ["americano", "latte", "chocolate", "lemonade"];

function withCustomizationDefaults(quotation: QuotationData): QuotationData {
  return {
    ...quotation,
    customizationOptions: quotation.customizationOptions ?? {
      cart: { mode: "same", designCount: 1 },
      sticker: { mode: "same", designCount: 1 },
      sleeve: { mode: "same", designCount: 1 }
    }
  };
}

function drinkTotalForDate(data: QuotationData, dateId: string): number {
  const order = data.drinkOrders[dateId] ?? {};
  return drinkIds.reduce((sum, drinkId) => {
    const quantity = order[drinkId] ?? { ice: 0, hot: 0 };
    return sum + quantity.ice + quantity.hot;
  }, 0);
}

export function InvoiceShell() {
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("A00001");
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [findName, setFindName] = useState("");
  const [findPhone, setFindPhone] = useState("");
  const [findQuotationNo, setFindQuotationNo] = useState("");
  const [reviewEditStep, setReviewEditStep] = useState<ReviewEditStep>("dates");
  const [reviewError, setReviewError] = useState("");
  const [eventAddress, setEventAddress] = useState("");
  const [dressCode, setDressCode] = useState("");
  const [customDressCode, setCustomDressCode] = useState("");
  const [environment, setEnvironment] = useState("");
  const [environmentNotes, setEnvironmentNotes] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [receiptDataUrl, setReceiptDataUrl] = useState("");
  const [acknowledgements, setAcknowledgements] = useState([false, false, false, false, false]);
  const [activeDesignDateId, setActiveDesignDateId] = useState("");
  const [cartDesigns, setCartDesigns] = useState<CustomizationByDate>({});
  const [sleeveDesigns, setSleeveDesigns] = useState<CustomizationByDate>({});
  const [stickerDesigns, setStickerDesigns] = useState<CustomizationByDate>({});
  const [isFindingQuotation, setIsFindingQuotation] = useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);

  useEffect(() => {
    getNextInvoiceNo()
      .then(setInvoiceNo)
      .catch(() => setError("Unable to load the next invoice number. Please check the API connection."));
  }, []);

  const steps = useMemo<InvoiceStep[]>(() => {
    if (!quotation) return [];
    const list: InvoiceStep[] = ["review", "acknowledgements", "preview", "receipt", "details"];
    if (quotation.selectedAddons.some((addon) => addon.name === "Custom Branded Cart")) list.push("cart");
    if (quotation.hasCupSleeves) list.push("sleeve");
    if (quotation.hasCupStickers) list.push("sticker");
    list.push("success");
    return list;
  }, [quotation]);

  const currentStep = steps[stepIndex];

  async function findQuotation() {
    setError("");
    setIsFindingQuotation(true);
    const quotationNo = findQuotationNo.trim().toUpperCase();
    try {
      const found = await findStoredQuotation({ quotationNo, name: findName, phone: findPhone });
      if (!found) {
        setError("We could not find this quotation. Please check your details or contact Hour Coffee.");
        return;
      }
      const approvedQuotation = withCustomizationDefaults(found);
      if (approvedQuotation.status !== "APPROVED") {
        setError("Your quotation is still pending approval. Please contact Hour Coffee or try again after approval.");
        return;
      }
      setQuotation(approvedQuotation);
      if (approvedQuotation.serviceDates[0]) setActiveDesignDateId(approvedQuotation.serviceDates[0].id);
      setStepIndex(0);
    } finally {
      setIsFindingQuotation(false);
    }
  }

  function validateEditedDates(): boolean {
    if (!quotation) return false;
    if (!quotation.serviceDates.length) {
      setReviewError("Please add at least one service date.");
      return false;
    }
    for (const date of quotation.serviceDates) {
      if (date.cups < 50) {
        setReviewError(`Minimum 50 cups for ${date.serviceDate}.`);
        return false;
      }
      if (!date.startTime || !date.endTime || date.endTime <= date.startTime) {
        setReviewError(`End time must be after start time for ${date.serviceDate}.`);
        return false;
      }
    }
    setReviewError("");
    return true;
  }

  function validateEditedDrinks(): boolean {
    if (!quotation) return false;
    for (const date of quotation.serviceDates) {
      if (drinkTotalForDate(quotation, date.id) !== date.cups) {
        setReviewError(`Drink quantities for ${date.serviceDate} must equal ${date.cups} cups.`);
        return false;
      }
    }
    setReviewError("");
    return true;
  }

  function designDates(type: "cart" | "sticker" | "sleeve"): ServiceDate[] {
    if (!quotation) return [];
    const option = quotation.customizationOptions?.[type] ?? { mode: "same", designCount: 1 };
    return option.mode === "same" ? quotation.serviceDates.slice(0, 1) : quotation.serviceDates.slice(0, Math.max(1, option.designCount));
  }

  function next() {
    setError("");
    if (currentStep === "review") return;
    if (currentStep === "acknowledgements" && acknowledgements.some((checked) => !checked)) return setError("Please tick all acknowledgements before continuing.");
    if (currentStep === "details" && !eventAddress.trim()) return setError("Please enter the full event address.");
    if (currentStep === "details" && (!dressCode || !environment)) return setError("Please select dress code and event environment.");
    if (currentStep === "details" && dressCode === "Custom" && !customDressCode.trim()) return setError("Please describe the custom dress code.");
    if (currentStep === "receipt" && !receiptName) return setError("Please upload your payment receipt before continuing.");
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setError("");
    setStepIndex((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!quotation) return;
    setError("");
    setIsSubmittingInvoice(true);
    const invoice: InvoiceDetails = {
      invoiceNo,
      quotation,
      eventAddress,
      dressCode,
      customDressCode,
      environment,
      environmentNotes,
      receiptName,
      receiptDataUrl,
      cartDesigns,
      stickerDesigns,
      sleeveDesigns,
      submittedAt: new Date().toISOString()
    };
    try {
      await saveInvoiceLocally(invoice);
      setStepIndex(steps.length - 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to submit invoice. Please try again.");
    } finally {
      setIsSubmittingInvoice(false);
    }
  }

  if (!quotation) {
    return (
      <main className="hc-page">
        <Card>
          <h2>Find your quotation</h2>
          <p className="step-copy">Enter your details to retrieve your quotation.</p>
          <label className="hc-field">
            <span>Customer name</span>
            <input value={findName} onChange={(event) => setFindName(event.target.value)} />
          </label>
          <label className="hc-field">
            <span>Phone number</span>
            <input value={findPhone} onChange={(event) => setFindPhone(event.target.value)} />
          </label>
          <label className="hc-field">
            <span>Quotation No.</span>
            <input value={findQuotationNo} onChange={(event) => setFindQuotationNo(event.target.value.toUpperCase())} placeholder="Q00001" />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button className="hc-button hc-button-primary find-button" type="button" onClick={findQuotation} disabled={isFindingQuotation}>
            {isFindingQuotation ? "FINDING..." : "FIND QUOTATION"}
          </button>
        </Card>
      </main>
    );
  }

  return (
    <main className="hc-page invoice-page">
      <div className="team-topbar">Hour Coffee - Invoice</div>
      <Card className="wide-card">
        <div className="progress-header">
          <div className="progress-text">
            Step {stepIndex + 1} of {steps.length}
          </div>
          <div className="progress-bar-line">
            {steps.map((step, index) => (
              <span className={`progress-dot ${index <= stepIndex ? "active" : ""}`} key={`${step}-${index}`} />
            ))}
          </div>
        </div>

        {currentStep === "review" ? (
          <div>
            <h2>Review and edit quotation details</h2>
            <p className="step-copy">Check your dates, drinks, add-ons, customization options and pricing before continuing.</p>
            <div className="tab-row">
              <button className={reviewEditStep === "dates" ? "active" : ""} type="button" onClick={() => setReviewEditStep("dates")}>
                Dates
              </button>
              <button className={reviewEditStep === "drinks" ? "active" : ""} type="button" onClick={() => setReviewEditStep("drinks")}>
                Drinks
              </button>
              <button className={reviewEditStep === "addons" ? "active" : ""} type="button" onClick={() => setReviewEditStep("addons")}>
                Add-ons
              </button>
            </div>
            {reviewEditStep === "dates" ? (
              <PlanEventStep
                serviceDates={quotation.serviceDates}
                setServiceDates={(serviceDates) => setQuotation({ ...quotation, serviceDates })}
                onNext={() => {
                  if (validateEditedDates()) setReviewEditStep("drinks");
                }}
                error={reviewError}
              />
            ) : null}
            {reviewEditStep === "drinks" ? (
              <DrinkPreferencesStep
                data={quotation}
                setData={setQuotation}
                onBack={() => setReviewEditStep("dates")}
                onNext={() => {
                  if (validateEditedDrinks()) setReviewEditStep("addons");
                }}
                error={reviewError}
              />
            ) : null}
            {reviewEditStep === "addons" ? (
              <AddOnsStep
                data={quotation}
                setData={setQuotation}
                onBack={() => setReviewEditStep("drinks")}
                onNext={() => {
                  setReviewError("");
                  setStepIndex((current) => Math.min(steps.length - 1, current + 1));
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            ) : null}
          </div>
        ) : null}
        {currentStep === "acknowledgements" ? <AcknowledgementsStep checked={acknowledgements} onChange={setAcknowledgements} /> : null}
        {currentStep === "preview" ? <InvoicePreview invoiceNo={invoiceNo} quotation={quotation} /> : null}
        {currentStep === "details" ? (
          <EventDetailsStep
            eventAddress={eventAddress}
            dressCode={dressCode}
            customDressCode={customDressCode}
            environment={environment}
            environmentNotes={environmentNotes}
            onEventAddress={setEventAddress}
            onDressCode={setDressCode}
            onCustomDressCode={setCustomDressCode}
            onEnvironment={setEnvironment}
            onEnvironmentNotes={setEnvironmentNotes}
          />
        ) : null}
        {currentStep === "receipt" ? <ReceiptUpload receiptName={receiptName} onReceiptName={setReceiptName} onReceiptDataUrl={setReceiptDataUrl} /> : null}
        {currentStep === "cart" ? (
          <CartLogoCustomizer serviceDates={designDates("cart")} designs={cartDesigns} activeDateId={activeDesignDateId || designDates("cart")[0]?.id || ""} onActiveDate={setActiveDesignDateId} onDesigns={setCartDesigns} />
        ) : null}
        {currentStep === "sleeve" ? (
          <CupSleeveCustomizer serviceDates={designDates("sleeve")} designs={sleeveDesigns} activeDateId={activeDesignDateId || designDates("sleeve")[0]?.id || ""} onActiveDate={setActiveDesignDateId} onDesigns={setSleeveDesigns} />
        ) : null}
        {currentStep === "sticker" ? (
          <CupStickerCustomizer serviceDates={designDates("sticker")} designs={stickerDesigns} activeDateId={activeDesignDateId || designDates("sticker")[0]?.id || ""} onActiveDate={setActiveDesignDateId} onDesigns={setStickerDesigns} />
        ) : null}
        {currentStep === "success" ? <InvoiceSuccess invoiceNo={invoiceNo} /> : null}

        {error ? <p className="error">{error}</p> : null}
        {currentStep !== "success" && currentStep !== "review" ? (
          <StepNavigation
            onBack={stepIndex > 0 ? back : undefined}
            canGoBack={stepIndex > 0}
            onNext={stepIndex === steps.length - 2 ? submit : next}
            nextLabel={stepIndex === steps.length - 2 ? (isSubmittingInvoice ? "SAVING..." : "DONE - NEXT STEP") : "CONTINUE"}
          />
        ) : null}
      </Card>
    </main>
  );
}
