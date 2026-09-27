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

function sleeveDesign(logos: CustomizationLogo[]): CustomizationDesign {
  const logo = logos[0];
  return {
    fileName: logo.fileName,
    dataUrl: logo.dataUrl,
    originalDataUrl: logo.originalDataUrl ?? logo.dataUrl,
    size: logo.size,
    rotation: logo.rotation,
    x: logo.x,
    y: logo.y,
    logos
  };
}

function readFile(file: File, callback: (logo: CustomizationLogo) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    callback({ id: crypto.randomUUID(), fileName: file.name, dataUrl, originalDataUrl: dataUrl, size: 34, rotation: 0, x: 50, y: 50 });
  };
  reader.readAsDataURL(file);
}

export function CupSleeveCustomizer({ mode, serviceDates, designs, activeDate, onActiveDate, onDesigns }: Props) {
  const [templateMissing, setTemplateMissing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const logosRef = useRef<CustomizationLogo[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selectedLogoId, setSelectedLogoId] = useState("");
  const dates = serviceDates.map((date) => date.serviceDate);
  const selectedDate = dates.includes(activeDate) ? activeDate : dates[0] ?? "";
  const activeKey = mode === "same" ? "shared" : selectedDate;
  const active = designs[activeKey];
  const logos = active?.logos?.length ? active.logos : active ? [{ id: "legacy-logo", fileName: active.fileName, dataUrl: active.dataUrl, originalDataUrl: active.originalDataUrl, size: active.size, rotation: active.rotation, x: active.x, y: active.y }] : [];
  logosRef.current = logos;
  const logo = logos.find((item) => item.id === selectedLogoId) ?? logos[0];

  function setLogos(nextLogos: CustomizationLogo[]) {
    if (!nextLogos.length) { const next = { ...designs }; delete next[activeKey]; onDesigns(next); return; }
    onDesigns({ ...designs, [activeKey]: sleeveDesign(nextLogos) });
  }

  function removeLogo(id: string) {
    setLogos(logos.filter((item) => item.id !== id));
    setSelectedLogoId("");
  }

  function updateLogo(patch: Partial<CustomizationLogo>) {
    if (!logo) return;
    const nextSize = Math.min(68, Math.max(8, patch.size ?? logo.size));
    setLogos(logos.map((item) => item.id === logo.id ? { ...item, ...patch, size: nextSize } : item));
  }

  function clampMove(value: number, halfSize: number): number {
    const minimum = Math.max(0, Math.min(halfSize, 50));
    const maximum = Math.max(50, 100 - halfSize);
    return Math.min(maximum, Math.max(minimum, value));
  }

  function moveLogo(event: PointerEvent<HTMLElement>) {
    const dragId = dragRef.current?.id;
    if (!dragId || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const current = (logosRef.current ?? []).find((item) => item.id === dragId);
    if (!current) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const half = current.size / 2;
    const nextX = clampMove(x, half);
    const nextY = clampMove(y, half);
    setLogos((logosRef.current ?? []).map((item) => item.id === dragId ? { ...item, x: nextX, y: nextY } : item));
  }

  function startDrag(event: PointerEvent<HTMLImageElement>, layer: CustomizationLogo) {
    event.preventDefault();
    setSelectedLogoId(layer.id);
    dragRef.current = { id: layer.id };
    setDragging(true);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* pointer capture already released */ }
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div className="customize-step customize-sleeve-step">
      <div className="customize-preview-pane">
        <div className="sleeve-preview">
          <div className="sleeve-template-preview" ref={previewRef}>
            <img className="custom-template-img" src={CUSTOMIZATION_ASSETS.sleeveTemplateUrl} alt="Sleeve template" onLoad={() => setTemplateMissing(false)} onError={() => setTemplateMissing(true)} />
            {logos.length ? logos.map((layer) => (
              <img
                key={layer.id}
                className={`sleeve-template-overlay sleeve-logo-layer ${dragging && selectedLogoId === layer.id ? "dragging" : ""}`}
                src={layer.originalDataUrl ?? layer.dataUrl}
                alt="Cup sleeve logo"
                onPointerDown={(event) => startDrag(event, layer)}
                onPointerMove={(event) => { if (dragRef.current?.id === layer.id) moveLogo(event); }}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                style={{ width: `${layer.size}%`, left: `${layer.x}%`, top: `${layer.y}%`, transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`, outline: selectedLogoId === layer.id ? "2px solid #32634c" : undefined }}
              />
            )) : <span>Sleeve design area</span>}
          </div>
        </div>
        {templateMissing ? <p className="template-missing">Template image not found. Please add the image file in public/assets/customization.</p> : null}
      </div>

      <div className="customize-controls-pane">
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

        <div className="sleeve-logo-controls">
          <label className="upload-box">
            <strong>Add sleeve artwork</strong>
            <span>PNG or JPG only</span>
            <input type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file, (next) => { setSelectedLogoId(next.id); setLogos([...logos, next]); }); event.currentTarget.value = ""; }} />
          </label>
          {logo ? <><p className="upload-ok">Selected: {logo.fileName} · {logos.length} layer(s)</p><button type="button" className="secondary-mini-button" onClick={() => removeLogo(logo.id)}>Remove selected layer</button></> : null}
        </div>

        {logo ? (
          <>
            <label className="range-field">Size<input type="range" min={8} max={68} step={0.5} value={Math.min(logo.size, 68)} onChange={(event) => updateLogo({ size: Number(event.target.value) })} /></label>
            <label className="range-field">Rotation: {logo.rotation}&deg;<input type="range" min={-180} max={180} step={1} value={logo.rotation} onChange={(event) => updateLogo({ rotation: Number(event.target.value) })} /></label>
          </>
        ) : null}
      </div>
    </div>
  );
}
