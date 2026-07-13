"use client";

import type { CustomizationByDate, CustomizationDesign, CustomizationLogo } from "../../types/customization";
import type { ServiceDate } from "../../types/quotation";
import { CUSTOMIZATION_ASSETS } from "../../lib/customization-assets";
import { formatShortDate } from "../../lib/formatters";
import type { PointerEvent } from "react";
import { useRef, useState } from "react";

type Props = {
  serviceDates: ServiceDate[];
  designCount: number;
  designs: CustomizationByDate;
  activeDesignId: string;
  onActiveDesign: (id: string) => void;
  dateAssignments: Record<string, string>;
  onDateAssignments: (assignments: Record<string, string>) => void;
  onDesigns: (designs: CustomizationByDate) => void;
};

function designId(index: number) {
  return `sleeve-design-${index + 1}`;
}

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

export function CupSleeveCustomizer({ serviceDates, designCount, designs, activeDesignId, onActiveDesign, dateAssignments, onDateAssignments, onDesigns }: Props) {
  const [templateMissing, setTemplateMissing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const slots = Array.from({ length: Math.max(1, designCount) }, (_, index) => designId(index));
  const activeKey = slots.includes(activeDesignId) ? activeDesignId : slots[0];
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
      <p className="step-copy">{slots.length === 1 ? "Upload one sleeve design for all selected dates." : "Upload each sleeve design, then choose which design is used on every selected date."}</p>

      {slots.length > 1 ? (
        <label className="hc-field">
          <span>Editing design</span>
          <select className="design-select" value={activeKey} onChange={(event) => onActiveDesign(event.target.value)}>
            {slots.map((slot, index) => <option value={slot} key={slot}>Design {index + 1}</option>)}
          </select>
        </label>
      ) : null}

      {slots.length > 1 ? (
        <div className="sleeve-date-assignments">
          <strong>Assign a design to each selected date</strong>
          {serviceDates.map((date) => (
            <label key={date.id}>
              <span>{formatShortDate(date.serviceDate)}</span>
              <select value={dateAssignments[date.id] ?? slots[0]} onChange={(event) => onDateAssignments({ ...dateAssignments, [date.id]: event.target.value })}>
                {slots.map((slot, index) => <option value={slot} key={slot}>Design {index + 1}</option>)}
              </select>
            </label>
          ))}
        </div>
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
              onPointerCancel={() => setDragging(false)}
              style={{ width: `${logo.size}%`, left: `${logo.x}%`, top: `${logo.y}%`, transform: `translate(-50%, -50%) rotate(${logo.rotation}deg)` }}
            />
          ) : <span>Sleeve design area</span>}
        </div>
      </div>
      {templateMissing ? <p className="template-missing">Template image not found. Please add the image file in public/assets/customization.</p> : null}

      <div className="sleeve-logo-controls">
        <label className="upload-box">
          <strong>{logo ? `Replace Design ${slots.indexOf(activeKey) + 1}` : `Upload Design ${slots.indexOf(activeKey) + 1}`}</strong>
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
