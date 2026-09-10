"use client";

import { useEffect, useMemo, useState } from "react";
import type { CustomizationByDate } from "../../types/customization";
import type { InvoiceDetails, InvoiceUploadFile } from "../../types/invoice";
import type { CustomizationMode, QuotationData } from "../../types/quotation";
import { CUSTOMIZATION_ASSETS } from "../../lib/customization-assets";
import { CART_SELECTION_ERROR, hasCartAddonConflict } from "../../lib/addons";
import { normalizeDesignGeometry, renderContainedDesignToCanvas } from "../../lib/customization-layout";
import { calculatePricing } from "../../lib/invoice-pricing";
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
import { CustomMenuUpload } from "./CustomMenuUpload";
import { InvoicePreview } from "./InvoicePreview";
import { InvoiceSuccess } from "./InvoiceSuccess";
import { ReceiptUpload } from "./ReceiptUpload";
import { SubmittedInvoiceView } from "./SubmittedInvoiceView";
import { generatePdfBlob } from "../../lib/pdf-document";

type InvoiceStep = "review" | "acknowledgements" | "receipt" | "details" | "cart" | "menu" | "sleeve" | "sticker" | "preview" | "success";
type ReviewEditStep = "dates" | "drinks" | "addons";

type CustomizationType = "cart" | "hot-cup" | "cold-cup" | "sleeve";
const submittedInvoiceIdentityKey = "hourCoffeeSubmittedInvoiceIdentity";

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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Template image not found. Please add the image file in public/assets/customization."));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/webp", quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to compress final customization preview."));
    }, type, quality);
  });
}

async function mergeCustomizationPreview(type: CustomizationType, design: NonNullable<CustomizationByDate[string]>): Promise<NonNullable<CustomizationByDate[string]>> {
  const templateUrl =
    type === "cart"
      ? CUSTOMIZATION_ASSETS.cartTemplateUrl
      : type === "hot-cup"
        ? CUSTOMIZATION_ASSETS.hotCupTemplateUrl
        : type === "cold-cup"
          ? CUSTOMIZATION_ASSETS.coldCupTemplateUrl
        : CUSTOMIZATION_ASSETS.sleeveTemplateUrl;
  const logoLayers = design.logos?.length ? design.logos : [design];
  const [templateImage, ...designImages] = await Promise.all([loadImage(templateUrl), ...logoLayers.map((logo) => loadImage(logo.originalDataUrl ?? logo.dataUrl))]);
  const canvas = document.createElement("canvas");
  const sourceWidth = templateImage.naturalWidth || 1000;
  const sourceHeight = templateImage.naturalHeight || 700;
  const scale = Math.min(1, 1600 / Math.max(sourceWidth, sourceHeight));
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create final customization preview.");

  context.drawImage(templateImage, 0, 0, width, height);
  logoLayers.forEach((logo, index) => {
    const designImage = designImages[index];
    const ratio = designImage.naturalHeight / Math.max(1, designImage.naturalWidth);
    if (type !== "sleeve") {
      const template = type === "cart" ? "cart" : type === "hot-cup" ? "hotCup" : "coldCup";
      const normalized = normalizeDesignGeometry({ ...design, ...logo, aspectRatio: ratio, rotation: 0 }, template);
      renderContainedDesignToCanvas(context, designImage, width, height, template, normalized);
      return;
    }
    const targetWidth = width * logo.size * 0.01;
    const targetHeight = targetWidth * ratio;
    context.save();
    context.translate((logo.x / 100) * width, (logo.y / 100) * height);
    context.rotate((logo.rotation * Math.PI) / 180);
    context.drawImage(designImage, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight);
    context.restore();
  });
  const blob = await canvasToBlob(canvas);
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });

  return {
    ...design,
    originalDataUrl: design.originalDataUrl ?? design.dataUrl,
    dataUrl,
    fileName: `final-${type}-${design.fileName.replace(/\.[^.]+$/, "")}.webp`
  };
}

async function mergeCustomizationGroup(type: CustomizationType, designs: CustomizationByDate): Promise<CustomizationByDate> {
  const entries = await Promise.all(
    Object.entries(designs).map(async ([dateId, design]) => [dateId, design ? await mergeCustomizationPreview(type, design) : design] as const)
  );
  return Object.fromEntries(entries);
}

async function mergeCupStickerDesigns(designs: CustomizationByDate): Promise<CustomizationByDate> {
  const pendingEntries = Object.entries(designs).flatMap(([designKey, design]) => {
    if (!design) return [];
    if (designKey.endsWith(":hot")) return [{ designKey, cupType: "hot-cup" as const, design }];
    if (designKey.endsWith(":cold")) return [{ designKey, cupType: "cold-cup" as const, design }];
    return [
      { designKey: `${designKey}:hot`, cupType: "hot-cup" as const, design: { ...design, rotation: 0 } },
      { designKey: `${designKey}:cold`, cupType: "cold-cup" as const, design: { ...design, rotation: 0 } }
    ];
  });
  const entries = await Promise.all(pendingEntries.map(async ({ designKey, cupType, design }) => [designKey, await mergeCustomizationPreview(cupType, design)] as const));
  return Object.fromEntries(entries);
}

function sameDesignMap(left: CustomizationByDate, right: CustomizationByDate): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => left[key] === right[key]);
}

function synchronizeDesigns(designs: CustomizationByDate, quotation: QuotationData, mode: CustomizationMode): CustomizationByDate {
  if (mode === "same") {
    const firstDate = quotation.serviceDates[0];
    const shared = designs.shared ?? designs[firstDate?.serviceDate] ?? designs[firstDate?.id] ?? Object.values(designs).find(Boolean);
    const next = shared ? { shared } : {};
    return sameDesignMap(designs, next) ? designs : next;
  }
  const next = Object.fromEntries(quotation.serviceDates.map((date) => [date.serviceDate, designs[date.serviceDate] ?? designs[date.id]]));
  return sameDesignMap(designs, next) ? designs : next;
}

function expandDesignsForDates(designs: CustomizationByDate, quotation: QuotationData, mode: CustomizationMode): CustomizationByDate {
  return Object.fromEntries(quotation.serviceDates.map((date) => [date.serviceDate, designs[mode === "same" ? "shared" : date.serviceDate]]));
}

export function InvoiceShell() {
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("A00001");
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [findName, setFindName] = useState("");
  const [findPhone, setFindPhone] = useState("");
  const [findQuotationNo, setFindQuotationNo] = useState("");
  const [lookupStatus, setLookupStatus] = useState("");
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
  const [activeDesignDate, setActiveDesignDate] = useState("");
  const [cartDesigns, setCartDesigns] = useState<CustomizationByDate>({});
  const [customMenuFile, setCustomMenuFile] = useState<InvoiceUploadFile | undefined>();
  const [sleeveDesigns, setSleeveDesigns] = useState<CustomizationByDate>({});
  const [stickerDesigns, setStickerDesigns] = useState<CustomizationByDate>({});
  const [isFindingQuotation, setIsFindingQuotation] = useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [submittedInvoice, setSubmittedInvoice] = useState<InvoiceDetails | null>(null);

  useEffect(() => {
    getNextInvoiceNo()
      .then(setInvoiceNo)
      .catch(() => setError("Unable to load the next invoice number. Please check the API connection."));
  }, []);

  useEffect(() => {
    const requestedInvoiceNo = new URLSearchParams(window.location.search).get("invoiceNo");
    if (!requestedInvoiceNo) return;
    const savedIdentity = window.sessionStorage.getItem(submittedInvoiceIdentityKey);
    if (!savedIdentity) return;
    try {
      const identity = JSON.parse(savedIdentity) as { quotationNo: string; name: string; phone: string; invoiceNo?: string };
      if (identity.invoiceNo && identity.invoiceNo !== requestedInvoiceNo) return;
      setFindQuotationNo(identity.quotationNo);
      setFindName(identity.name);
      setFindPhone(identity.phone);
      void findQuotation(identity);
    } catch {
      window.sessionStorage.removeItem(submittedInvoiceIdentityKey);
    }
  }, []);

  useEffect(() => {
    if (!quotation) return;
    const options = quotation.customizationOptions;
    setCartDesigns((current) => synchronizeDesigns(current, quotation, options.cart.mode));
    setStickerDesigns((current) => synchronizeDesigns(current, quotation, options.sticker.mode));
    setSleeveDesigns((current) => synchronizeDesigns(current, quotation, options.sleeve.mode));
    const dates = quotation.serviceDates.map((date) => date.serviceDate);
    setActiveDesignDate((current) => dates.includes(current) ? current : dates[0] ?? "");
  }, [quotation]);

  const steps = useMemo<InvoiceStep[]>(() => {
    if (!quotation) return [];
    const list: InvoiceStep[] = ["review", "acknowledgements", "preview", "receipt", "details"];
    const hasCart = quotation.selectedAddons.some((addon) => addon.name === "Custom Branded Cart");
    const hasCustomMenu = quotation.selectedAddons.some((addon) => addon.name.toLowerCase() === "custom menu");
    if (hasCart) list.push("cart");
    if (hasCustomMenu) list.push("menu");
    if (quotation.hasCupSleeves) list.push("sleeve");
    if (quotation.hasCupStickers) list.push("sticker");
    list.push("success");
    return list;
  }, [quotation]);

  const currentStep = steps[stepIndex];

  async function findQuotation(override?: { quotationNo: string; name: string; phone: string }) {
    setError("");
    setLookupStatus("");
    setIsFindingQuotation(true);
    const quotationNo = (override?.quotationNo ?? findQuotationNo).trim().toUpperCase();
    const name = override?.name ?? findName;
    const phone = override?.phone ?? findPhone;
    try {
      const result = await findStoredQuotation({ quotationNo, name, phone });
      if (!result.matched) {
        setError("We could not find this quotation. Please check your details and try again.");
        return;
      }
      if (result.access === "PENDING_REVIEW") {
        setLookupStatus("Your quotation is being reviewed. We will contact you shortly.");
        return;
      }
      if (result.access === "DRAFT_INVOICE") {
        setLookupStatus(`Invoice draft ${result.invoiceNo} already exists for this quotation.`);
        return;
      }
      if (result.access === "SUBMITTED_INVOICE") {
        setSubmittedInvoice(result.invoice);
        window.sessionStorage.setItem(submittedInvoiceIdentityKey, JSON.stringify({ quotationNo, name, phone, invoiceNo: result.invoiceNo }));
        window.history.replaceState(null, "", `/invoice?invoiceNo=${encodeURIComponent(result.invoiceNo)}`);
        return;
      }
      const approvedQuotation = withCustomizationDefaults(result.quotation);
      setQuotation(approvedQuotation);
      if (approvedQuotation.serviceDates[0]) setActiveDesignDate(approvedQuotation.serviceDates[0].serviceDate);
      setStepIndex(0);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to find the quotation. Please try again.");
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
      const beverageIds = Object.keys(quotation.beverageSnapshots ?? {});
      const excluded = new Set(quotation.excludedBeverageIdsByDate?.[date.id] ?? []);
      if (beverageIds.length > 0 && beverageIds.every((id) => excluded.has(id))) {
        setReviewError("Please keep at least one drink available for your event.");
        return false;
      }
    }
    setReviewError("");
    return true;
  }

  function hasRequiredDesigns(type: "cart" | "sticker", designs: CustomizationByDate): boolean {
    if (!quotation) return false;
    const mode = quotation.customizationOptions[type].mode;
    const keys = mode === "same" ? ["shared"] : quotation.serviceDates.map((date) => date.serviceDate);
    return keys.every((key) => Boolean(designs[key]?.dataUrl));
  }

  function hasRequiredSleeveDesigns(designs: CustomizationByDate): boolean {
    if (!quotation) return false;
    const mode = quotation.customizationOptions.sleeve.mode;
    const keys = mode === "same" ? ["shared"] : quotation.serviceDates.map((date) => date.serviceDate);
    return keys.every((key) => {
      const design = designs[key];
      return Boolean(design && ((design.logos?.length ?? 0) > 0 || design.dataUrl));
    });
  }

  function next() {
    setError("");
    if (currentStep === "review") return;
    if (currentStep === "acknowledgements" && acknowledgements.some((checked) => !checked)) return setError("Please tick all acknowledgements before continuing.");
    if (currentStep === "details" && !eventAddress.trim()) return setError("Please enter the full event address.");
    if (currentStep === "details" && (!dressCode || !environment)) return setError("Please select dress code and event environment.");
    if (currentStep === "details" && dressCode === "Custom" && !customDressCode.trim()) return setError("Please describe the custom dress code.");
    if (currentStep === "receipt" && !receiptName) return setError("Please upload your payment receipt before continuing.");
    if (currentStep === "menu" && !customMenuFile) return setError("Please upload your custom menu file before continuing.");
    if (currentStep === "cart" && !hasRequiredDesigns("cart", cartDesigns)) return setError("Please upload the required cart design for every selected date.");
    if (currentStep === "sticker" && !hasRequiredDesigns("sticker", stickerDesigns)) return setError("Please upload the required cup sticker design for every selected date.");
    if (currentStep === "sleeve" && !hasRequiredSleeveDesigns(sleeveDesigns)) return setError("Please upload each required sleeve design before continuing.");
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
    if (hasCartAddonConflict(quotation.selectedAddons)) return setError(CART_SELECTION_ERROR);
    if (quotation.selectedAddons.some((addon) => addon.name === "Custom Branded Cart") && !hasRequiredDesigns("cart", cartDesigns)) return setError("Please upload the required cart design for every selected date.");
    if (quotation.hasCupStickers && !hasRequiredDesigns("sticker", stickerDesigns)) return setError("Please upload the required cup sticker design for every selected date.");
    if (quotation.hasCupSleeves && !hasRequiredSleeveDesigns(sleeveDesigns)) return setError("Please upload each required sleeve design before continuing.");
    if (quotation.selectedAddons.some((addon) => addon.name.toLowerCase() === "custom menu") && !customMenuFile) return setError("Please upload your custom menu file before continuing.");
    setIsSubmittingInvoice(true);
    try {
      const [finalCartDesigns, finalStickerDesigns, finalSleeveDesigns] = await Promise.all([
        mergeCustomizationGroup("cart", expandDesignsForDates(cartDesigns, quotation, quotation.customizationOptions.cart.mode)),
        mergeCupStickerDesigns(expandDesignsForDates(stickerDesigns, quotation, quotation.customizationOptions.sticker.mode)),
        mergeCustomizationGroup("sleeve", expandDesignsForDates(sleeveDesigns, quotation, quotation.customizationOptions.sleeve.mode))
      ]);
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
        customMenuFile,
        cartDesigns: finalCartDesigns,
        stickerDesigns: finalStickerDesigns,
        sleeveDesigns: finalSleeveDesigns,
        submittedAt: new Date().toISOString()
      };
      const invoicePdf = await generatePdfBlob("invoiceSubmissionPreview", { filename: `Hour-Coffee-Invoice-${invoiceNo}.pdf` });
      await saveInvoiceLocally(invoice, invoicePdf);
      setStepIndex(steps.length - 1);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to submit invoice. Please try again.");
    } finally {
      setIsSubmittingInvoice(false);
    }
  }

  if (submittedInvoice) return <SubmittedInvoiceView invoice={submittedInvoice} />;

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
          {lookupStatus ? <p className="lookup-status">{lookupStatus}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button className="hc-button hc-button-primary find-button" type="button" onClick={() => findQuotation()} disabled={isFindingQuotation}>
            {isFindingQuotation ? "FINDING..." : "FIND QUOTATION"}
          </button>
        </Card>
      </main>
    );
  }

  return (
    <main className="hc-page invoice-page">
      <div className="team-topbar">Hour Coffee - Invoice</div>
      <Card className={`wide-card ${currentStep === "preview" ? "invoice-preview-card" : "invoice-flow-card"}`}>
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
                setServiceDates={(serviceDates) => {
                  setQuotation((current) => {
                    if (!current) return current;
                    const selectedIds = new Set(serviceDates.map((date) => date.id));
                    const drinkOrders = Object.fromEntries(Object.entries(current.drinkOrders).filter(([dateId]) => selectedIds.has(dateId))) as typeof current.drinkOrders;
                    return { ...current, serviceDates, drinkOrders };
                  });
                }}
                onNext={() => {
                  if (validateEditedDates()) setReviewEditStep("drinks");
                }}
                error={reviewError}
                pricing={calculatePricing(quotation)}
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
                useLatestPrices={false}
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
          <CartLogoCustomizer mode={quotation.customizationOptions.cart.mode} serviceDates={quotation.serviceDates} designs={cartDesigns} activeDate={activeDesignDate} onActiveDate={setActiveDesignDate} onDesigns={setCartDesigns} />
        ) : null}
        {currentStep === "menu" ? <CustomMenuUpload file={customMenuFile} onFile={setCustomMenuFile} /> : null}
        {currentStep === "sleeve" ? (
          <CupSleeveCustomizer
            mode={quotation.customizationOptions.sleeve.mode}
            serviceDates={quotation.serviceDates}
            designs={sleeveDesigns}
            activeDate={activeDesignDate}
            onActiveDate={setActiveDesignDate}
            onDesigns={setSleeveDesigns}
          />
        ) : null}
        {currentStep === "sticker" ? (
          <CupStickerCustomizer mode={quotation.customizationOptions.sticker.mode} serviceDates={quotation.serviceDates} designs={stickerDesigns} activeDate={activeDesignDate} onActiveDate={setActiveDesignDate} onDesigns={setStickerDesigns} />
        ) : null}
        {currentStep === "success" ? <InvoiceSuccess invoiceNo={invoiceNo} /> : null}

        {currentStep !== "preview" && currentStep !== "success" ? (
          <div className="print-document" aria-hidden="true">
            <InvoicePreview
              invoiceNo={invoiceNo}
              quotation={quotation}
              invoice={{
                invoiceNo,
                quotation,
                eventAddress,
                dressCode,
                customDressCode,
                environment,
                environmentNotes,
                receiptName,
                submittedAt: new Date().toISOString()
              }}
              documentId="invoiceSubmissionPreview"
              showDownloadButton={false}
            />
          </div>
        ) : null}

        {error ? <p className="error">{error}</p> : null}
        {currentStep !== "success" && currentStep !== "review" ? (
          <StepNavigation
            onBack={stepIndex > 0 ? back : undefined}
            canGoBack={stepIndex > 0}
            onNext={stepIndex === steps.length - 2 ? submit : next}
            nextLabel={currentStep === "preview" ? "PROCEED TO PAYMENT" : stepIndex === steps.length - 2 ? (isSubmittingInvoice ? "SAVING..." : "DONE - NEXT STEP") : "CONTINUE"}
          />
        ) : null}
      </Card>
    </main>
  );
}
