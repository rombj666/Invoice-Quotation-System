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
  getContainedWidthBounds,
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

const CART_DISPLAY_MAX_LOGO_SIZE_CM = 60;

function readFile(file: File, callback: (design: CustomizationDesign) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    const image = new Image();
    image.onload = () => {
      callback(createDefaultDesignGeometry({
        fileName: file.name,
        dataUrl,
        originalDataUrl: dataUrl,
        size: 35,
        rotation: 0,
        x: 50,
        y: 50,
        aspectRatio: image.naturalHeight / Math.max(1, image.naturalWidth)
      }, "cart", 0.35));
    };
    image.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

export function CartLogoCustomizer({ mode, serviceDates, designs, activeDate, onActiveDate, onDesigns }: Props) {
  const [templateMissing, setTemplateMissing] = useState(false);
  const dates = serviceDates.map((date) => date.serviceDate);
  const selectedDate = dates.includes(activeDate) ? activeDate : dates[0] ?? "";
  const activeKey = mode === "same" ? "shared" : selectedDate;
  const rawActive = designs[activeKey];
  const active = rawActive ? normalizeDesignGeometry(rawActive, "cart") : undefined;
  const aspectRatio = active ? designAspectRatio(active) : 1;
  const bounds = getContainedWidthBounds("cart", aspectRatio);
  const rect = active ? calculateContainedDesignRect("cart", active) : null;
  const cartLayout = CUSTOMIZATION_LAYOUT.cart;
  const area = cartLayout.designArea;
  const physicalWidthCm = rect ? rect.widthRatio * (cartLayout.physicalAreaCm?.width ?? 0) : 0;
  const physicalHeightCm = rect ? rect.heightRatio * (cartLayout.physicalAreaCm?.height ?? 0) : 0;
  const maximumPhysicalSizeCm = rect
    ? Math.max(physicalWidthCm, physicalHeightCm) * (bounds.max / rect.widthRatio)
    : 0;
  const displayScale = maximumPhysicalSizeCm > 0
    ? CART_DISPLAY_MAX_LOGO_SIZE_CM / maximumPhysicalSizeCm
    : 0;
  const widthCm = physicalWidthCm * displayScale;
  const heightCm = physicalHeightCm * displayScale;

  function updateWidth(widthRatio: number) {
    if (!active) return;
    const next = normalizeDesignGeometry({ ...active, size: widthRatio * 100, widthRatio }, "cart");
    onDesigns({ ...designs, [activeKey]: next });
  }

  return (
    <div>
      <h2>Cart Logo</h2>
      <p className="step-copy">Upload your logo to preview it centered on the cart's white front panel.</p>
      {mode === "per-date" && serviceDates.length > 1 ? (
        <label className="hc-field">
          <span>Editing design</span>
          <select className="design-select" value={selectedDate} onChange={(event) => onActiveDate(event.target.value)}>
            {serviceDates.map((date) => <option value={date.serviceDate} key={date.serviceDate}>{formatCustomizationDate(date.serviceDate)}</option>)}
          </select>
        </label>
      ) : null}
      <div className="cart-preview">
        <img className="custom-template-img" src={CUSTOMIZATION_ASSETS.cartTemplateUrl} alt="Cart template" onLoad={() => setTemplateMissing(false)} onError={() => setTemplateMissing(true)} />
        <div
          className={`cart-template-overlay cart-design-panel ${SHOW_CUSTOMIZATION_BOUNDARIES ? "custom-boundary-debug" : ""}`}
          style={{ left: `${area.x * 100}%`, top: `${area.y * 100}%`, width: `${area.width * 100}%`, height: `${area.height * 100}%` }}
        >
          {active && rect ? (
            <img
              src={active.originalDataUrl ?? active.dataUrl}
              alt="Cart logo preview"
              style={{
                width: `${rect.widthRatio * 100}%`,
                left: `${rect.centerXRatio * 100}%`,
                top: `${rect.centerYRatio * 100}%`,
                transform: "translate(-50%, -50%)"
              }}
            />
          ) : <span>Cart logo preview</span>}
          {SHOW_CUSTOMIZATION_BOUNDARIES && rect ? <small className="custom-debug-label">x {rect.centerXRatio.toFixed(3)} y {rect.centerYRatio.toFixed(3)} w {rect.widthRatio.toFixed(3)}</small> : null}
        </div>
      </div>
      {templateMissing ? <p className="template-missing">Template image not found. Please add the image file in public/assets/customization.</p> : null}
      <label className="upload-box">
        <strong>Tap to upload logo</strong>
        <span>PNG or JPG only</span>
        <input type="file" accept="image/png,image/jpeg" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) readFile(file, (design) => onDesigns({ ...designs, [activeKey]: design }));
        }} />
      </label>
      {active && rect ? (
        <>
          <p className="upload-ok">Uploaded: {active.fileName}</p>
          <label className="range-field">
            Logo size
            <input type="range" min={bounds.min} max={bounds.max} step={0.001} value={rect.widthRatio} onChange={(event) => updateWidth(Number(event.target.value))} />
          </label>
          <div className="mini-summary">Logo size: {widthCm.toFixed(1)} cm x {heightCm.toFixed(1)} cm ({Math.round(rect.widthRatio * 100)}%)</div>
          <p className="field-reminder">The displayed measurements represent the estimated real-life logo size.</p>
        </>
      ) : null}
    </div>
  );
}
