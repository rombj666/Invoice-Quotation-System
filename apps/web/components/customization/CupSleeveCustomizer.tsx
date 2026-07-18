"use client";

import type { PointerEvent } from "react";
import { useRef, useState } from "react";
import type { CustomizationByDate, CustomizationDesign, CustomizationLogo } from "../../types/customization";
import type { CustomizationMode, ServiceDate } from "../../types/quotation";
import { CUSTOMIZATION_ASSETS } from "../../lib/customization-assets";
import { formatCustomizationDate } from "../../lib/customization-layout";

type Props = {
  mode: CustomizationMode;
  serviceDates: ServiceDate[];
  designs: CustomizationByDate;
  activeDate: string;
  onActiveDate: (isoDate: string) => void;
  onDesigns: (designs: CustomizationByDate) => void;
};

function emptySleeveDesign(logo: CustomizationLogo): CustomizationDesign {
  return {
    fileName: logo.fileName,
    dataUrl: logo.dataUrl,
    originalDataUrl: logo.originalDataUrl ?? logo.dataUrl,
    size: logo.size,
    rotation: logo.rotation,
    x: logo.x,
    y: logo.y,
    logos: [logo]
  };
}

function readFile(file: File, callback: (logo: CustomizationLogo) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    callback({ id: "logo1", fileName: file.name, dataUrl, originalDataUrl: dataUrl, size: 34, rotation: 0, x: 50, y: 50 });
  };
  reader.readAsDataURL(file);
}

export function CupSleeveCustomizer({ mode, serviceDates, designs, activeDate, onActiveDate, onDesigns }: Props) {
  const [templateMissing, setTemplateMissing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const dates = serviceDates.map((date) => date.serviceDate);
  const selectedDate = dates.includes(activeDate) ? activeDate : dates[0] ?? "";
  const activeKey = mode === "same" ? "shared" : selectedDate;
  const active = designs[activeKey];
  const logo = active?.logos?.[0] ?? (active ? { id: "logo1", fileName: active.fileName, dataUrl: active.dataUrl, originalDataUrl: active.originalDataUrl, size: active.size, rotation: active.rotation, x: active.x, y: active.y } : undefined);

  function setLogo(nextLogo: CustomizationLogo) {
    onDesigns({ ...designs, [activeKey]: emptySleeveDesign(nextLogo) });
  }

  function removeLogo() {
    const nextDesigns = { ...designs };
    delete nextDesigns[activeKey];
    onDesigns(nextDesigns);
  }

  function updateLogo(patch: Partial<CustomizationLogo>) {
    if (!logo) return;
    const nextSize = Math.min(68, Math.max(8, patch.size ?? logo.size));
    setLogo({ ...logo, ...patch, size: nextSize });
  }

  function moveLogo(event: PointerEvent<HTMLImageElement>) {
    if (!logo || !previewRef.current) return;
    event.preventDefault();
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setLogo({ ...logo, x: Math.min(92, Math.max(8, x)), y: Math.min(88, Math.max(12, y)) });
  }

  return (
    <div>
      <h2>Cup Sleeve Logos</h2>
      <p className="step-copy">{mode === "same" ? "Upload one sleeve design for all selected dates." : "Upload one sleeve design for each selected date."}</p>

      {mode === "per-date" && serviceDates.length > 1 ? (
        <label className="hc-field">
          <span>Editing design</span>
          <select className="design-select" value={selectedDate} onChange={(event) => onActiveDate(event.target.value)}>
            {serviceDates.map((date) => <option value={date.serviceDate} key={date.serviceDate}>{formatCustomizationDate(date.serviceDate)}</option>)}
          </select>
        </label>
      ) : null}

      <div className="sleeve-preview">
        <div className="sleeve-template-preview" ref={previewRef}>
          <img className="custom-template-img" src={CUSTOMIZATION_ASSETS.sleeveTemplateUrl} alt="Sleeve template" onLoad={() => setTemplateMissing(false)} onError={() => setTemplateMissing(true)} />
          {logo ? (
            <img
              className={`sleeve-template-overlay sleeve-logo-layer ${dragging ? "dragging" : ""}`}
              src={logo.originalDataUrl ?? logo.dataUrl}
              alt="Cup sleeve logo"
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); moveLogo(event); }}
              onPointerMove={(event) => { if (dragging) moveLogo(event); }}
              onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false); }}
              onPointerCancel={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setDragging(false); }}
              style={{ width: `${logo.size}%`, left: `${logo.x}%`, top: `${logo.y}%`, transform: `translate(-50%, -50%) rotate(${logo.rotation}deg)` }}
            />
          ) : <span>Sleeve design area</span>}
        </div>
      </div>
      {templateMissing ? <p className="template-missing">Template image not found. Please add the image file in public/assets/customization.</p> : null}

      <div className="sleeve-logo-controls">
        <label className="upload-box">
          <strong>{logo ? "Replace sleeve design" : "Upload sleeve design"}</strong>
          <span>PNG or JPG only</span>
          <input type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file, setLogo); }} />
        </label>
        {logo ? <><p className="upload-ok">Uploaded: {logo.fileName}</p><button type="button" className="secondary-mini-button" onClick={removeLogo}>Remove</button></> : null}
      </div>

      {logo ? (
        <>
          <label className="range-field">Size<input type="range" min={8} max={68} step={0.5} value={Math.min(logo.size, 68)} onChange={(event) => updateLogo({ size: Number(event.target.value) })} /></label>
          <label className="range-field">Rotation: {logo.rotation}&deg;<input type="range" min={-180} max={180} step={1} value={logo.rotation} onChange={(event) => updateLogo({ rotation: Number(event.target.value) })} /></label>
        </>
      ) : null}
    </div>
  );
}
