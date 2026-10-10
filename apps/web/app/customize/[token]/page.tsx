"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/common/Card";
import { StepNavigation } from "../../../components/common/StepNavigation";
import { ArtworkCustomizer } from "../../../components/customization/ArtworkCustomizer";
import { CartLogoCustomizer } from "../../../components/customization/CartLogoCustomizer";
import { CupSleeveCustomizer } from "../../../components/customization/CupSleeveCustomizer";
import { CupStickerCustomizer } from "../../../components/customization/CupStickerCustomizer";
import { FoamBoardCustomizer } from "../../../components/customization/FoamBoardCustomizer";
import { AcknowledgementsStep, acknowledgementLabels } from "../../../components/invoice/AcknowledgementsStep";
import { EventDetailsStep } from "../../../components/invoice/EventDetailsStep";
import { LATTE_PHYSICAL, MENU_PHYSICAL } from "../../../lib/customization-layout";
import { getCustomerCustomizationSteps } from "../../../lib/customization-flow";
import { loadCustomization, submitCustomization } from "../../../lib/customization-storage";
import type { CustomizationByDate } from "../../../types/customization";
import type { InvoiceDetails, InvoiceUploadFile } from "../../../types/invoice";

export function CustomizationFlow({ token, onComplete }: { token: string; onComplete?: () => void }) {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [acknowledgements, setAcknowledgements] = useState<boolean[]>(acknowledgementLabels.map(() => false));
  const [stepIndex, setStepIndex] = useState(0);
  const [eventAddress, setEventAddress] = useState("");
  const [dressCode, setDressCode] = useState("");
  const [customDressCode, setCustomDressCode] = useState("");
  const [environment, setEnvironment] = useState("");
  const [environmentNotes, setEnvironmentNotes] = useState("");
  const [activeDate, setActiveDate] = useState("");
  const [cartDesigns, setCartDesigns] = useState<CustomizationByDate>({});
  const [sleeveDesigns, setSleeveDesigns] = useState<CustomizationByDate>({});
  const [stickerDesigns, setStickerDesigns] = useState<CustomizationByDate>({});
  const [foamBoardDesigns, setFoamBoardDesigns] = useState<CustomizationByDate>({});
  const [customMenu, setCustomMenu] = useState<InvoiceUploadFile>();
  const [latteArt, setLatteArt] = useState<InvoiceUploadFile>();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => { loadCustomization(token).then((loaded) => { setInvoice(loaded); setEventAddress(loaded.eventAddress || ""); setActiveDate(loaded.quotation.serviceDates[0]?.serviceDate ?? ""); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to open customization.")); }, [token]);
  const steps = useMemo(() => invoice ? ["acknowledgements", ...getCustomerCustomizationSteps(invoice.quotation)] : [], [invoice]);
  const current = steps[stepIndex];

  async function finish() {
    if (!invoice) return;
    setSubmitting(true); setError("");
    try {
      await submitCustomization(token, { acknowledgements, eventAddress, dressCode, customDressCode, environment, environmentNotes, cartDesigns, sleeveDesigns, stickerDesigns, foamBoardDesigns, customMenu, latteArt });
      setComplete(true);
      onComplete?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit customization."); }
    finally { setSubmitting(false); }
  }

  function continueStep() {
    if (!invoice) return;
    if (current === "details") {
      if (!eventAddress.trim()) return setError("Please enter the full event address.");
      if (!dressCode || !environment) return setError("Please select a dress code and event environment.");
      if (dressCode === "Custom" && !customDressCode.trim()) return setError("Please describe the custom dress code.");
    }
    if (current === "cart") {
      const mode = invoice.quotation.customizationOptions?.cart?.mode ?? "same";
      const keys = mode === "same" ? ["shared"] : invoice.quotation.serviceDates.map((date) => date.serviceDate);
      if (!keys.every((key) => Boolean(cartDesigns[key]?.dataUrl))) return setError("Please upload the required cart design for every selected date.");
    }
    if (current === "sticker") {
      const mode = invoice.quotation.customizationOptions?.sticker?.mode ?? "same";
      const keys = mode === "same" ? ["shared"] : invoice.quotation.serviceDates.map((date) => date.serviceDate);
      if (!keys.every((key) => Boolean(stickerDesigns[key]?.dataUrl))) return setError("Please upload the required cup sticker design for every selected date.");
    }
    if (current === "sleeve") {
      const mode = invoice.quotation.customizationOptions?.sleeve?.mode ?? "same";
      const keys = mode === "same" ? ["shared"] : invoice.quotation.serviceDates.map((date) => date.serviceDate);
      if (!keys.every((key) => Boolean(sleeveDesigns[key] && ((sleeveDesigns[key]?.logos?.length ?? 0) > 0 || sleeveDesigns[key]?.dataUrl)))) return setError("Please upload each required sleeve design before continuing.");
    }
    if (current === "foamBoard") {
      const mode = invoice.quotation.customizationOptions?.cart?.mode ?? "same";
      const keys = mode === "same" ? ["shared"] : invoice.quotation.serviceDates.map((date) => date.serviceDate);
      if (!keys.every((key) => Boolean(foamBoardDesigns[key]?.originalDataUrl ?? foamBoardDesigns[key]?.dataUrl))) return setError("Please upload a foam board design for every selected date.");
    }
    if (current === "menu" && !customMenu) return setError("Please upload your custom menu file before continuing.");
    if (current === "latte" && !latteArt) return setError("Please upload your latte art file before continuing.");
    setError("");
    setStepIndex((index) => Math.min(steps.length - 1, index + 1));
  }

  if (!invoice) return <main className="hc-page"><Card><h2>Customization</h2><p className={error ? "error" : undefined}>{error || "Loading..."}</p></Card></main>;
  if (complete) return <main className="hc-page"><Card><h2>Done</h2><p>Thank you. Your event setup and artwork have been sent to Hour Coffee.</p>{customMenu ? <p>Custom Menu: A4 · {MENU_PHYSICAL.width} × {MENU_PHYSICAL.height} cm</p> : null}{latteArt ? <p>Latte Art / Print Pen: {LATTE_PHYSICAL.printDiameterCm} cm print area · artwork {latteArt.actualArtworkSizeCm?.width.toFixed(1)} × {latteArt.actualArtworkSizeCm?.height.toFixed(1)} cm</p> : null}</Card></main>;

  return <main className="hc-page invoice-page customize-page"><div className="team-topbar">Hour Coffee - Customization</div><Card className="wide-card invoice-flow-card">
    <div className="progress-header customize-progress-header"><div className="progress-text">Step {stepIndex + 1} of {steps.length}</div><div className="progress-bar-line">{steps.map((step, index) => <span className={`progress-dot ${index <= stepIndex ? "active" : ""}`} key={step} />)}</div></div>
    <div className="customize-step-body">
      {current === "acknowledgements" ? <AcknowledgementsStep checked={acknowledgements} onChange={setAcknowledgements} /> : null}
      {current === "details" ? <div className="customize-step customize-details-step"><EventDetailsStep eventAddress={eventAddress} dressCode={dressCode} customDressCode={customDressCode} environment={environment} environmentNotes={environmentNotes} onEventAddress={setEventAddress} onDressCode={setDressCode} onCustomDressCode={setCustomDressCode} onEnvironment={setEnvironment} onEnvironmentNotes={setEnvironmentNotes} /></div> : null}
      {current === "cart" ? <CartLogoCustomizer mode={invoice.quotation.customizationOptions?.cart?.mode ?? "same"} serviceDates={invoice.quotation.serviceDates} designs={cartDesigns} activeDate={activeDate} onActiveDate={setActiveDate} onDesigns={setCartDesigns} /> : null}
      {current === "sleeve" ? <CupSleeveCustomizer mode={invoice.quotation.customizationOptions?.sleeve?.mode ?? "same"} serviceDates={invoice.quotation.serviceDates} designs={sleeveDesigns} activeDate={activeDate} onActiveDate={setActiveDate} onDesigns={setSleeveDesigns} /> : null}
      {current === "sticker" ? <CupStickerCustomizer mode={invoice.quotation.customizationOptions?.sticker?.mode ?? "same"} serviceDates={invoice.quotation.serviceDates} designs={stickerDesigns} activeDate={activeDate} onActiveDate={setActiveDate} onDesigns={setStickerDesigns} /> : null}
      {current === "foamBoard" ? <FoamBoardCustomizer mode={invoice.quotation.customizationOptions?.cart?.mode ?? "same"} serviceDates={invoice.quotation.serviceDates} designs={foamBoardDesigns} activeDate={activeDate} onActiveDate={setActiveDate} onDesigns={setFoamBoardDesigns} /> : null}
      {current === "menu" ? <ArtworkCustomizer kind="menu" file={customMenu} onFile={setCustomMenu} /> : null}
      {current === "latte" ? <ArtworkCustomizer kind="latte" file={latteArt} onFile={setLatteArt} /> : null}
      {current === "finish" ? <div className="customize-step customize-finish-step"><div className="customize-finish-card"><h2>Final Submit</h2><p className="step-copy">Submit the event setup and any artwork you added.</p></div></div> : null}
      {error ? <p className="error">{error}</p> : null}
    </div>
    <div className="customize-nav"><StepNavigation canGoBack={stepIndex > 0} onBack={() => setStepIndex((index) => Math.max(0, index - 1))} onNext={current === "finish" ? finish : continueStep} nextLabel={current === "finish" ? submitting ? "SUBMITTING..." : "FINAL SUBMIT" : "CONTINUE"} nextDisabled={submitting || (current === "acknowledgements" && !acknowledgements.every(Boolean))} /></div>
  </Card></main>;
}

export default function CustomerCustomizationPage() {
  const { token } = useParams<{ token: string }>();
  return <CustomizationFlow token={token} />;
}
