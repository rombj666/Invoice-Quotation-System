"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../components/common/Card";
import { StepNavigation } from "../../../components/common/StepNavigation";
import { ArtworkCustomizer } from "../../../components/customization/ArtworkCustomizer";
import { CartLogoCustomizer } from "../../../components/customization/CartLogoCustomizer";
import { CupSleeveCustomizer } from "../../../components/customization/CupSleeveCustomizer";
import { CupStickerCustomizer } from "../../../components/customization/CupStickerCustomizer";
import { EventDetailsStep } from "../../../components/invoice/EventDetailsStep";
import { getCustomerCustomizationSteps } from "../../../lib/customization-flow";
import { loadCustomization, submitCustomization } from "../../../lib/customization-storage";
import type { CustomizationByDate } from "../../../types/customization";
import type { InvoiceDetails, InvoiceUploadFile } from "../../../types/invoice";

export function CustomizationFlow({ token, onComplete }: { token: string; onComplete?: () => void }) {
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
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
  const [customMenu, setCustomMenu] = useState<InvoiceUploadFile>();
  const [latteArt, setLatteArt] = useState<InvoiceUploadFile>();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => { loadCustomization(token).then((loaded) => { setInvoice(loaded); setEventAddress(loaded.eventAddress || ""); setActiveDate(loaded.quotation.serviceDates[0]?.serviceDate ?? ""); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to open customization.")); }, [token]);
  const steps = useMemo(() => invoice ? getCustomerCustomizationSteps(invoice.quotation) : [], [invoice]);
  const current = steps[stepIndex];

  async function finish() {
    if (!invoice) return;
    setSubmitting(true); setError("");
    try {
      await submitCustomization(token, { eventAddress, dressCode, customDressCode, environment, environmentNotes, cartDesigns, sleeveDesigns, stickerDesigns, customMenu, latteArt });
      setComplete(true);
      onComplete?.();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to submit customization."); }
    finally { setSubmitting(false); }
  }

  if (!invoice) return <main className="hc-page"><Card><h2>Customization</h2><p className={error ? "error" : undefined}>{error || "Loading..."}</p></Card></main>;
  if (complete) return <main className="hc-page"><Card><h2>Customization Submitted</h2><p>Thank you. Your event setup and artwork have been sent to Hour Coffee.</p>{customMenu ? <p>Custom Menu: A4 · 21 × 29.7 cm</p> : null}{latteArt ? <p>Latte Art / Print Pen: 8 cm diameter print area</p> : null}</Card></main>;

  return <main className="hc-page invoice-page"><div className="team-topbar">Hour Coffee - Customization</div><Card className="wide-card invoice-flow-card">
    <div className="progress-header"><div className="progress-text">Step {stepIndex + 1} of {steps.length}</div><div className="progress-bar-line">{steps.map((step, index) => <span className={`progress-dot ${index <= stepIndex ? "active" : ""}`} key={step} />)}</div></div>
    {current === "details" ? <EventDetailsStep eventAddress={eventAddress} dressCode={dressCode} customDressCode={customDressCode} environment={environment} environmentNotes={environmentNotes} onEventAddress={setEventAddress} onDressCode={setDressCode} onCustomDressCode={setCustomDressCode} onEnvironment={setEnvironment} onEnvironmentNotes={setEnvironmentNotes} /> : null}
    {current === "cart" ? <CartLogoCustomizer mode={invoice.quotation.customizationOptions?.cart?.mode ?? "same"} serviceDates={invoice.quotation.serviceDates} designs={cartDesigns} activeDate={activeDate} onActiveDate={setActiveDate} onDesigns={setCartDesigns} /> : null}
    {current === "sleeve" ? <CupSleeveCustomizer mode={invoice.quotation.customizationOptions?.sleeve?.mode ?? "same"} serviceDates={invoice.quotation.serviceDates} designs={sleeveDesigns} activeDate={activeDate} onActiveDate={setActiveDate} onDesigns={setSleeveDesigns} /> : null}
    {current === "sticker" ? <CupStickerCustomizer mode={invoice.quotation.customizationOptions?.sticker?.mode ?? "same"} serviceDates={invoice.quotation.serviceDates} designs={stickerDesigns} activeDate={activeDate} onActiveDate={setActiveDate} onDesigns={setStickerDesigns} /> : null}
    {current === "menu" ? <ArtworkCustomizer kind="menu" file={customMenu} onFile={setCustomMenu} /> : null}
    {current === "latte" ? <ArtworkCustomizer kind="latte" file={latteArt} onFile={setLatteArt} /> : null}
    {current === "finish" ? <div><h2>Finish Customization</h2><p className="step-copy">Submit the event setup and any artwork you added.</p></div> : null}
    {error ? <p className="error">{error}</p> : null}
    <StepNavigation canGoBack={stepIndex > 0} onBack={() => setStepIndex((index) => Math.max(0, index - 1))} onNext={current === "finish" ? finish : () => setStepIndex((index) => Math.min(steps.length - 1, index + 1))} nextLabel={current === "finish" ? submitting ? "SUBMITTING..." : "FINISH CUSTOMIZATION" : "CONTINUE"} nextDisabled={submitting} />
  </Card></main>;
}

export default function CustomerCustomizationPage() {
  const { token } = useParams<{ token: string }>();
  return <CustomizationFlow token={token} />;
}
