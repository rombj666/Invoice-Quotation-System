"use client";

import type { CustomizationByDate, CustomizationDesign, CustomizationLogo } from "../../types/customization";
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

function emptySleeveDesign(fileName: string, dataUrl: string, logos: CustomizationLogo[]): CustomizationDesign {
  return {
    fileName,
    dataUrl,
    originalDataUrl: dataUrl,
    size: 34,
    rotation: 0,
    x: 50,
    y: 50,
    logos
  };
}

function readFile(file: File, id: string, callback: (logo: CustomizationLogo) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    callback({ id, fileName: file.name, dataUrl, originalDataUrl: dataUrl, size: 34, rotation: 0, x: id === "logo1" ? 42 : 58, y: 50 });
  };
  reader.readAsDataURL(file);
}

export function CupSleeveCustomizer({ serviceDates, designs, activeDateId, onActiveDate, onDesigns }: Props) {
  const [templateMissing, setTemplateMissing] = useState(false);
  const [selectedLogoId, setSelectedLogoId] = useState("logo1");
  const previewRef = useRef<HTMLDivElement>(null);
  const [draggingLogoId, setDraggingLogoId] = useState("");
  const activeKey = serviceDates.some((date) => date.id === activeDateId) ? activeDateId : serviceDates[0]?.id ?? "";
  const active = designs[activeKey];
  const logos = active?.logos ?? (active ? [{ id: "logo1", fileName: active.fileName, dataUrl: active.dataUrl, originalDataUrl: active.originalDataUrl, size: active.size, rotation: active.rotation, x: active.x, y: active.y }] : []);
  const selectedLogo = logos.find((logo) => logo.id === selectedLogoId) ?? logos[0];

  function saveLogos(nextLogos: CustomizationLogo[]) {
    const firstLogo = nextLogos[0];
    if (!firstLogo) {
      const nextDesigns = { ...designs };
      delete nextDesigns[activeKey];
      onDesigns(nextDesigns);
      return;
    }
    onDesigns({
      ...designs,
      [activeKey]: emptySleeveDesign(firstLogo.fileName, firstLogo.originalDataUrl ?? firstLogo.dataUrl, nextLogos)
    });
  }

  function setLogo(nextLogo: CustomizationLogo) {
    saveLogos(logos.some((logo) => logo.id === nextLogo.id) ? logos.map((logo) => (logo.id === nextLogo.id ? nextLogo : logo)) : [...logos, nextLogo].slice(0, 2));
    setSelectedLogoId(nextLogo.id);
  }

  function removeLogo(id: string) {
    const nextLogos = logos.filter((logo) => logo.id !== id);
    saveLogos(nextLogos);
    setSelectedLogoId(nextLogos[0]?.id ?? "logo1");
  }

  function updateSelected(patch: Partial<CustomizationLogo>) {
    if (!selectedLogo) return;
    const nextSize = Math.min(68, Math.max(8, patch.size ?? selectedLogo.size));
    const nextLogo = { ...selectedLogo, ...patch, size: nextSize };
    setLogo(nextLogo);
  }

  function moveLogo(event: PointerEvent<HTMLElement>, logo: CustomizationLogo) {
    if (!previewRef.current) return;
    event.preventDefault();
    const rect = previewRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setLogo({ ...logo, x: Math.min(92, Math.max(8, x)), y: Math.min(88, Math.max(12, y)) });
  }

  function startDrag(event: PointerEvent<HTMLImageElement>, logo: CustomizationLogo) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedLogoId(logo.id);
    setDraggingLogoId(logo.id);
    moveLogo(event, logo);
  }

  function drag(event: PointerEvent<HTMLImageElement>, logo: CustomizationLogo) {
    if (draggingLogoId === logo.id) moveLogo(event, logo);
  }

  function endDrag(event: PointerEvent<HTMLImageElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingLogoId("");
  }

  return (
    <div>
      <h2>Cup Sleeve Logos</h2>
      <p className="step-copy">Upload up to two sleeve logos/designs and adjust each one separately.</p>
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
          {logos.map((logo) => (
            <img
              className={`sleeve-template-overlay sleeve-logo-layer ${draggingLogoId === logo.id ? "dragging" : ""}`}
              src={logo.originalDataUrl ?? logo.dataUrl}
              alt={logo.id === "logo1" ? "Cup sleeve logo 1" : "Cup sleeve logo 2"}
              key={logo.id}
              onPointerDown={(event) => startDrag(event, logo)}
              onPointerMove={(event) => drag(event, logo)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                width: `${logo.size}%`,
                left: `${logo.x}%`,
                top: `${logo.y}%`,
                transform: `translate(-50%, -50%) rotate(${logo.rotation}deg)`
              }}
            />
          ))}
          {!logos.length ? <span>Sleeve design area</span> : null}
        </div>
      </div>
      {templateMissing ? <p className="template-missing">Template image not found. Please add the image file in public/assets/customization.</p> : null}

      <div className="custom-upload-grid">
        {(["logo1", "logo2"] as const).map((logoId) => {
          const logo = logos.find((item) => item.id === logoId);
          return (
            <div className="sleeve-logo-controls" key={logoId}>
              <label className="upload-box">
                <strong>{logoId === "logo1" ? "Upload Logo 1" : "Upload Logo 2 optional"}</strong>
                <span>PNG or JPG only</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) readFile(file, logoId, setLogo);
                  }}
                />
              </label>
              {logo ? (
                <>
                  <p className="upload-ok">Uploaded: {logo.fileName}</p>
                  <button type="button" className="secondary-mini-button" onClick={() => removeLogo(logo.id)}>Remove</button>
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {selectedLogo ? (
        <>
          <p className="mini-summary">Editing {selectedLogo.id === "logo1" ? "Logo 1" : "Logo 2"}</p>
          <label className="range-field">
            Size
            <input type="range" min={8} max={68} step={0.5} value={Math.min(selectedLogo.size, 68)} onChange={(event) => updateSelected({ size: Number(event.target.value) })} />
          </label>
          <label className="range-field">
            Rotation: {selectedLogo.rotation}&deg;
            <input type="range" min={-180} max={180} step={1} value={selectedLogo.rotation} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} />
          </label>
        </>
      ) : null}
    </div>
  );
}
