"use client";

import type { CustomizationByDate, CustomizationDesign } from "../../types/customization";
import type { ServiceDate } from "../../types/quotation";
import { CART_DESIGN_PANEL, CUSTOMIZATION_ASSETS, getCartLogoSizeBounds } from "../../lib/customization-assets";
import { formatShortDate } from "../../lib/formatters";
import { useState } from "react";

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
    const image = new Image();
    image.onload = () => {
      callback({ fileName: file.name, dataUrl, originalDataUrl: dataUrl, size: 28, rotation: 0, x: 50, y: 50, aspectRatio: image.naturalHeight / Math.max(1, image.naturalWidth) });
    };
    image.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

export const cartPanelPercent = CART_DESIGN_PANEL;

const cartPanelSizeCm = 90;

export function CartLogoCustomizer({ serviceDates, designs, activeDateId, onActiveDate, onDesigns }: Props) {
  const [templateMissing, setTemplateMissing] = useState(false);
  const activeKey = serviceDates.some((date) => date.id === activeDateId) ? activeDateId : serviceDates[0]?.id ?? "";
  const active = designs[activeKey];
  const aspectRatio = active?.aspectRatio ?? 1;
  const { min: minSize, max: maxSize } = getCartLogoSizeBounds(aspectRatio);
  const safeActiveSize = active ? Math.min(Math.max(active.size, minSize), maxSize) : 0;
  const widthCm = active ? (safeActiveSize / 100) * cartPanelSizeCm : 0;
  const heightCm = widthCm * aspectRatio;

  function update(patch: Partial<CustomizationDesign>) {
    if (!active) return;
    const nextSize = Math.min(maxSize, Math.max(minSize, patch.size ?? active.size));
    const nextWidthCm = (nextSize / 100) * cartPanelSizeCm;
    const nextHeightCm = nextWidthCm * aspectRatio;
    const halfWidth = nextSize / 2;
    const halfHeight = (nextSize * aspectRatio) / 2;
    const nextX = Math.min(100 - halfWidth, Math.max(halfWidth, patch.x ?? active.x));
    const nextY = Math.min(100 - halfHeight, Math.max(halfHeight, patch.y ?? active.y));
    onDesigns({
      ...designs,
      [activeKey]: {
        ...active,
        ...patch,
        size: nextSize,
        x: nextX,
        y: nextY,
        xPercent: nextX,
        yPercent: nextY,
        widthPercent: nextSize,
        heightPercent: nextSize * aspectRatio,
        widthCm: nextWidthCm,
        heightCm: nextHeightCm
      }
    });
  }

  return (
    <div>
      <h2>Cart Logo</h2>
      <p className="step-copy">Upload your logo to preview it centered on the coffee cart. Use the size slider to resize.</p>
      {serviceDates.length > 1 ? (
        <select className="design-select" value={activeKey} onChange={(event) => onActiveDate(event.target.value)}>
          {serviceDates.map((date, index) => (
            <option value={date.id} key={date.id}>
              Design {index + 1} - {formatShortDate(date.serviceDate)}
            </option>
          ))}
        </select>
      ) : null}
      <div className="cart-preview">
        <img className="custom-template-img" src={CUSTOMIZATION_ASSETS.cartTemplateUrl} alt="Cart template" onLoad={() => setTemplateMissing(false)} onError={() => setTemplateMissing(true)} />
        <div
          className="cart-template-overlay cart-design-panel"
          style={{
            left: `${cartPanelPercent.left}%`,
            top: `${cartPanelPercent.top}%`,
            width: `${cartPanelPercent.width}%`,
            height: `${cartPanelPercent.height}%`
          }}
        >
          {active ? (
            <img
              src={active.originalDataUrl ?? active.dataUrl}
              alt="Cart logo preview"
              style={{
                width: `${safeActiveSize}%`,
                left: `${active.x}%`,
                top: `${active.y}%`,
                transform: `translate(-50%, -50%) rotate(${active.rotation}deg)`
              }}
            />
          ) : <span>Cart logo preview</span>}
        </div>
      </div>
      {templateMissing ? <p className="template-missing">Template image not found. Please add the image file in public/assets/customization.</p> : null}
      <label className="upload-box">
        <strong>Tap to upload logo</strong>
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
            Logo size
            <input type="range" min={minSize} max={maxSize} step={0.25} value={Math.min(Math.max(active.size, minSize), maxSize)} onChange={(event) => update({ size: Number(event.target.value) })} />
          </label>
          <div className="mini-summary">Logo size: {widthCm.toFixed(1)}cm x {heightCm.toFixed(1)}cm</div>
        </>
      ) : null}
    </div>
  );
}
