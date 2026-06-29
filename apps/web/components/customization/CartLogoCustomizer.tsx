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

function readFile(file: File, callback: (design: CustomizationDesign) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    callback({ fileName: file.name, dataUrl, originalDataUrl: dataUrl, size: 30, rotation: 0, x: 50, y: 62 });
  };
  reader.readAsDataURL(file);
}

export function CartLogoCustomizer({ serviceDates, designs, activeDateId, onActiveDate, onDesigns }: Props) {
  const [templateMissing, setTemplateMissing] = useState(false);
  const activeKey = serviceDates.some((date) => date.id === activeDateId) ? activeDateId : serviceDates[0]?.id ?? "";
  const active = designs[activeKey];

  function update(patch: Partial<CustomizationDesign>) {
    if (!active) return;
    onDesigns({ ...designs, [activeKey]: { ...active, ...patch } });
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
        <div className="cart-template-overlay">
          {active ? <img src={active.originalDataUrl ?? active.dataUrl} alt="Cart logo preview" style={{ width: `${active.size}%` }} /> : <span>Cart logo preview</span>}
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
            <input type="range" min={5} max={60} value={active.size} onChange={(event) => update({ size: Number(event.target.value) })} />
          </label>
        </>
      ) : null}
    </div>
  );
}
