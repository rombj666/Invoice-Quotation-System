"use client";

import type { CustomizationByDate, CustomizationDesign } from "../../types/customization";
import type { ServiceDate } from "../../types/quotation";
import { CUSTOMIZATION_ASSETS } from "../../lib/customization-assets";
import { formatShortDate } from "../../lib/formatters";
import type { PointerEvent } from "react";
import { useRef, useState } from "react";

type Props = {
  serviceDates: ServiceDate[];
  designs: CustomizationByDate;
  activeDateId: string;
  onActiveDate: (id: string) => void;
  onDesigns: (designs: CustomizationByDate) => void;
};

function readFile(file: File, callback: (design: CustomizationDesign) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    callback({ fileName: file.name, dataUrl, originalDataUrl: dataUrl, size: 36, rotation: 0, x: 50, y: 50 });
  };
  reader.readAsDataURL(file);
}

export function CupSleeveCustomizer({ serviceDates, designs, activeDateId, onActiveDate, onDesigns }: Props) {
  const [templateMissing, setTemplateMissing] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const activeKey = serviceDates.some((date) => date.id === activeDateId) ? activeDateId : serviceDates[0]?.id ?? "";
  const active = designs[activeKey];

  function update(patch: Partial<CustomizationDesign>) {
    if (!active) return;
    onDesigns({ ...designs, [activeKey]: { ...active, ...patch } });
  }

  function moveDesign(event: PointerEvent<HTMLElement>) {
    if (!active || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    update({ x: Math.min(90, Math.max(10, x)), y: Math.min(85, Math.max(15, y)) });
  }

  return (
    <div>
      <h2>Cup Sleeve Logo</h2>
      <p className="step-copy">Upload your sleeve design and adjust its placement for the preview.</p>
      {serviceDates.length > 1 ? (
        <select className="design-select" value={activeKey} onChange={(event) => onActiveDate(event.target.value)}>
          {serviceDates.map((date, index) => (
            <option value={date.id} key={date.id}>
              Design {index + 1} - {formatShortDate(date.serviceDate)}
            </option>
          ))}
        </select>
      ) : null}
      <div className="sleeve-preview">
        <div className="sleeve-template-preview" ref={previewRef}>
          <img className="custom-template-img" src={CUSTOMIZATION_ASSETS.sleeveTemplateUrl} alt="Sleeve template" onLoad={() => setTemplateMissing(false)} onError={() => setTemplateMissing(true)} />
          {active ? (
            <img
              className={`sleeve-template-overlay ${isDragging ? "dragging" : ""}`}
              src={active.originalDataUrl ?? active.dataUrl}
              alt="Cup sleeve design"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setIsDragging(true);
                moveDesign(event);
              }}
              onPointerMove={(event) => {
                if (isDragging) moveDesign(event);
              }}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);
                setIsDragging(false);
              }}
              onPointerCancel={() => setIsDragging(false)}
              style={{
                width: `${active.size}%`,
                left: `${active.x}%`,
                top: `${active.y}%`,
                transform: `translate(-50%, -50%) rotate(${active.rotation}deg)`
              }}
            />
          ) : (
            <span>Sleeve design area</span>
          )}
        </div>
      </div>
      {templateMissing ? <p className="template-missing">Template image not found. Please add the image file in public/assets/customization.</p> : null}
      <label className="upload-box">
        <strong>Tap to upload sleeve design</strong>
        <span>PNG or JPG only</span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readFile(file, (design) => onDesigns({ ...designs, [activeKey]: design }));
          }}
        />
      </label>
      {active ? (
        <>
          <p className="upload-ok">Uploaded: {active.fileName}</p>
          <label className="range-field">
            Size
            <input type="range" min={16} max={90} step={0.5} value={active.size} onChange={(event) => update({ size: Number(event.target.value) })} />
          </label>
          <label className="range-field">
            Rotation
            <input type="range" min={-30} max={30} step={0.5} value={active.rotation} onChange={(event) => update({ rotation: Number(event.target.value) })} />
          </label>
        </>
      ) : null}
    </div>
  );
}
