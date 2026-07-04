"use client";

import type { CustomizationByDate, CustomizationDesign } from "../../types/customization";
import type { ServiceDate } from "../../types/quotation";
import { CUSTOMIZATION_ASSETS } from "../../lib/customization-assets";
import { formatShortDate } from "../../lib/formatters";
import { useState } from "react";

type Props = {
  serviceDates: ServiceDate[];
  designs: CustomizationByDate;
  activeDateId: string;
  onActiveDate: (id: string) => void;
  onDesigns: (designs: CustomizationByDate) => void;
};

function readFile(file: File, callback: (design: CustomizationDesign) => void, y = 50) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    callback({ fileName: file.name, dataUrl, originalDataUrl: dataUrl, size: 34, rotation: 0, x: 50, y });
  };
  reader.readAsDataURL(file);
}

export function CupStickerCustomizer({ serviceDates, designs, activeDateId, onActiveDate, onDesigns }: Props) {
  const [missingTemplates, setMissingTemplates] = useState({ hot: false, cold: false });
  const activeKey = serviceDates.some((date) => date.id === activeDateId) ? activeDateId : serviceDates[0]?.id ?? "";
  const activeDesign = designs[activeKey];

  function update(patch: Partial<CustomizationDesign>) {
    if (!activeDesign) return;
    onDesigns({ ...designs, [activeKey]: { ...activeDesign, ...patch, size: Math.min(patch.size ?? activeDesign.size, 58) } });
  }

  function setBoth(design: CustomizationDesign) {
    onDesigns({ ...designs, [activeKey]: { ...design, size: Math.min(design.size, 58), y: 50 } });
  }

  function logo(design: CustomizationDesign | undefined, label: string) {
    return design ? (
      <img
        src={design.originalDataUrl ?? design.dataUrl}
        alt={label}
        style={{
          width: `${design.size}%`,
          left: `${design.x}%`,
          top: `${design.y}%`,
          transform: `translate(-50%, -50%) rotate(${design.rotation}deg)`
        }}
      />
    ) : null;
  }

  return (
    <div>
      <h2>Cup Sticker Logo</h2>
      <p className="step-copy">Upload one logo for both cup sticker previews.</p>
      {serviceDates.length > 1 ? (
        <select className="design-select" value={activeKey} onChange={(event) => onActiveDate(event.target.value)}>
          {serviceDates.map((date, index) => (
            <option value={date.id} key={date.id}>
              Design {index + 1} - {formatShortDate(date.serviceDate)}
            </option>
          ))}
        </select>
      ) : null}
      <div className="cup-template-grid">
        <div>
          <strong className="custom-preview-label">Hot cup</strong>
          <div className="cup-template-preview">
            <img className="custom-template-img" src={CUSTOMIZATION_ASSETS.hotCupTemplateUrl} alt="Hot cup template" onLoad={() => setMissingTemplates((current) => ({ ...current, hot: false }))} onError={() => setMissingTemplates((current) => ({ ...current, hot: true }))} />
            <div className="cup-template-overlay">{logo(activeDesign ? { ...activeDesign, y: 56 } : undefined, "Hot cup sticker logo")}</div>
          </div>
        </div>
        <div>
          <strong className="custom-preview-label">Cold cup</strong>
          <div className="cup-template-preview">
            <img className="custom-template-img" src={CUSTOMIZATION_ASSETS.coldCupTemplateUrl} alt="Cold cup template" onLoad={() => setMissingTemplates((current) => ({ ...current, cold: false }))} onError={() => setMissingTemplates((current) => ({ ...current, cold: true }))} />
            <div className="cup-template-overlay">{logo(activeDesign ? { ...activeDesign, y: 50 } : undefined, "Cold cup sticker logo")}</div>
          </div>
        </div>
      </div>
      {missingTemplates.hot || missingTemplates.cold ? <p className="template-missing">Template image not found. Please add the image file in public/assets/customization.</p> : null}
      <label className="upload-box">
        <strong>Tap to upload same logo for both cups</strong>
        <span>PNG or JPG only</span>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readFile(file, setBoth);
          }}
        />
      </label>
      {activeDesign ? (
        <>
          <p className="upload-ok">Uploaded: {activeDesign.fileName}</p>
          <p className="upload-ok">Same logo is applied to both cup templates.</p>
          <label className="range-field">
            Logo size
            <input type="range" min={10} max={58} value={Math.min(activeDesign.size, 58)} onChange={(event) => update({ size: Number(event.target.value) })} />
          </label>
          <label className="range-field">
            Rotation: {activeDesign.rotation}°
            <input type="range" min={-180} max={180} value={activeDesign.rotation} onChange={(event) => update({ rotation: Number(event.target.value) })} />
          </label>
        </>
      ) : null}
    </div>
  );
}
