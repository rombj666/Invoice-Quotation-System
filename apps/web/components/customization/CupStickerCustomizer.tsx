"use client";

import { useState } from "react";
import type { CustomizationByDate, CustomizationDesign } from "../../types/customization";
import type { CustomizationMode, ServiceDate } from "../../types/quotation";
import { CUSTOMIZATION_ASSETS } from "../../lib/customization-assets";
import {
  calculateContainedDesignRect,
  createDefaultDesignGeometry,
  CUSTOMIZATION_LAYOUT,
  designAspectRatio,
  formatCustomizationDate,
  getCupLogoSizeMm,
  getCupWidthBounds,
  normalizeDesignGeometry,
  SHOW_CUSTOMIZATION_BOUNDARIES
} from "../../lib/customization-layout";

type Props = {
  mode: CustomizationMode;
  serviceDates: ServiceDate[];
  designs: CustomizationByDate;
  activeDate: string;
  onActiveDate: (isoDate: string) => void;
  onDesigns: (designs: CustomizationByDate) => void;
};

function readFile(file: File, callback: (design: CustomizationDesign) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    const image = new Image();
    image.onload = () => {
      const base = createDefaultDesignGeometry({
        fileName: file.name,
        dataUrl,
        originalDataUrl: dataUrl,
        size: 30,
        rotation: 0,
        x: 50,
        y: 50,
        aspectRatio: image.naturalHeight / Math.max(1, image.naturalWidth),
        hotWidthRatio: 0.3,
        coldWidthRatio: 0.3
      }, "hotCup", 0.3);
      callback(normalizeDesignGeometry({ ...base, coldWidthRatio: 0.3 }, "coldCup"));
    };
    image.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

export function CupStickerCustomizer({ mode, serviceDates, designs, activeDate, onActiveDate, onDesigns }: Props) {
  const [missingTemplates, setMissingTemplates] = useState({ hot: false, cold: false });
  const dates = serviceDates.map((date) => date.serviceDate);
  const selectedDate = dates.includes(activeDate) ? activeDate : dates[0] ?? "";
  const activeKey = mode === "same" ? "shared" : selectedDate;
  const rawDesign = designs[activeKey];
  const activeDesign = rawDesign
    ? normalizeDesignGeometry(normalizeDesignGeometry({ ...rawDesign, rotation: 0 }, "hotCup"), "coldCup")
    : undefined;
  const aspectRatio = activeDesign ? designAspectRatio(activeDesign) : 1;
  const bounds = getCupWidthBounds(aspectRatio);
  const logoSizeMm = activeDesign ? getCupLogoSizeMm(activeDesign) : null;

  function updateWidth(widthRatio: number) {
    if (!activeDesign) return;
    const next = normalizeDesignGeometry(normalizeDesignGeometry({
      ...activeDesign,
      size: widthRatio * 100,
      rotation: 0,
      widthRatio,
      hotWidthRatio: widthRatio,
      coldWidthRatio: widthRatio
    }, "hotCup"), "coldCup");
    onDesigns({ ...designs, [activeKey]: next });
  }

  function preview(template: "hotCup" | "coldCup", label: string, url: string, missingKey: "hot" | "cold") {
    const area = CUSTOMIZATION_LAYOUT[template].designArea;
    const rect = activeDesign ? calculateContainedDesignRect(template, activeDesign) : null;
    return (
      <div>
        <strong className="custom-preview-label">{label}</strong>
        <div className="cup-template-preview">
          <img className="custom-template-img" src={url} alt={`${label} template`} onLoad={() => setMissingTemplates((current) => ({ ...current, [missingKey]: false }))} onError={() => setMissingTemplates((current) => ({ ...current, [missingKey]: true }))} />
          <div
            className={`cup-template-overlay cup-design-area ${SHOW_CUSTOMIZATION_BOUNDARIES ? "custom-boundary-debug" : ""}`}
            style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.width * 100}%`, height: `${area.height * 100}%` }}
          >
            {activeDesign && rect ? <img src={activeDesign.originalDataUrl ?? activeDesign.dataUrl} alt={`${label} sticker logo`} style={{ width: `${rect.widthRatio * 100}%`, left: `${rect.centerXRatio * 100}%`, top: `${rect.centerYRatio * 100}%`, transform: "translate(-50%, -50%)" }} /> : null}
            {SHOW_CUSTOMIZATION_BOUNDARIES && rect ? <small className="custom-debug-label">x {rect.centerXRatio.toFixed(3)} y {rect.centerYRatio.toFixed(3)} w {rect.widthRatio.toFixed(3)}</small> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Cup Sticker Logo</h2>
      <p className="step-copy">Upload one logo for both cup sticker previews.</p>
      {mode === "per-date" && serviceDates.length > 1 ? (
        <label className="hc-field">
          <span>Editing design</span>
          <select className="design-select" value={selectedDate} onChange={(event) => onActiveDate(event.target.value)}>
            {serviceDates.map((date) => <option value={date.serviceDate} key={date.serviceDate}>{formatCustomizationDate(date.serviceDate)}</option>)}
          </select>
        </label>
      ) : null}
      <div className="cup-template-grid">
        {preview("hotCup", "Hot cup", CUSTOMIZATION_ASSETS.hotCupTemplateUrl, "hot")}
        {preview("coldCup", "Cold cup", CUSTOMIZATION_ASSETS.coldCupTemplateUrl, "cold")}
      </div>
      {missingTemplates.hot || missingTemplates.cold ? <p className="template-missing">Template image not found. Please add the image file in public/assets/customization.</p> : null}
      <label className="upload-box">
        <strong>Tap to upload same logo for both cups</strong>
        <span>PNG or JPG only</span>
        <input type="file" accept="image/png,image/jpeg" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) readFile(file, (design) => onDesigns({ ...designs, [activeKey]: design }));
        }} />
      </label>
      {activeDesign ? (
        <>
          <p className="upload-ok">Uploaded: {activeDesign.fileName}</p>
          <p className="upload-ok">Same logo is applied to both cup templates.</p>
          <label className="range-field">
            Logo size
            <input type="range" min={bounds.min} max={bounds.max} step={0.001} value={Math.min(bounds.max, Math.max(bounds.min, activeDesign.widthRatio ?? activeDesign.size / 100))} onChange={(event) => updateWidth(Number(event.target.value))} />
          </label>
          {logoSizeMm ? <div className="mini-summary">Logo size: {logoSizeMm.width.toFixed(1)} mm x {logoSizeMm.height.toFixed(1)} mm</div> : null}
          <p className="field-reminder">The displayed measurements represent the estimated real-life logo size.</p>
        </>
      ) : null}
    </div>
  );
}
