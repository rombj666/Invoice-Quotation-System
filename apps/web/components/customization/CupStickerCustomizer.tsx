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
  const hotKey = `${activeKey}:hot`;
  const coldKey = `${activeKey}:cold`;
  const hotDesign = designs[hotKey] ?? designs[activeKey];
  const coldDesign = designs[coldKey] ?? designs[activeKey];
  const hasSameDesign = Boolean(hotDesign && coldDesign && hotDesign.originalDataUrl === coldDesign.originalDataUrl);

  function update(target: "hot" | "cold", patch: Partial<CustomizationDesign>) {
    const key = target === "hot" ? hotKey : coldKey;
    const active = target === "hot" ? hotDesign : coldDesign;
    if (!active) return;
    onDesigns({ ...designs, [key]: { ...active, ...patch } });
  }

  function setBoth(design: CustomizationDesign) {
    onDesigns({
      ...designs,
      [hotKey]: { ...design, y: 56 },
      [coldKey]: { ...design, y: 50 }
    });
  }

  function setOne(target: "hot" | "cold", design: CustomizationDesign) {
    onDesigns({ ...designs, [target === "hot" ? hotKey : coldKey]: design });
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
    ) : <span>Logo</span>;
  }

  return (
    <div>
      <h2>Cup Sticker Logo</h2>
      <p className="step-copy">Upload one logo for both cups, or upload separate designs for hot and cold cups.</p>
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
            <div className="cup-template-overlay">{logo(hotDesign, "Hot cup sticker logo")}</div>
          </div>
        </div>
        <div>
          <strong className="custom-preview-label">Cold cup</strong>
          <div className="cup-template-preview">
            <img className="custom-template-img" src={CUSTOMIZATION_ASSETS.coldCupTemplateUrl} alt="Cold cup template" onLoad={() => setMissingTemplates((current) => ({ ...current, cold: false }))} onError={() => setMissingTemplates((current) => ({ ...current, cold: true }))} />
            <div className="cup-template-overlay">{logo(coldDesign, "Cold cup sticker logo")}</div>
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
      <div className="custom-upload-grid">
        <label className="upload-box">
          <strong>Upload hot cup logo</strong>
          <span>PNG or JPG only</span>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readFile(file, (design) => setOne("hot", design), 56);
            }}
          />
        </label>
        <label className="upload-box">
          <strong>Upload cold cup logo</strong>
          <span>PNG or JPG only</span>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readFile(file, (design) => setOne("cold", design), 50);
            }}
          />
        </label>
      </div>
      {hotDesign || coldDesign ? (
        <>
          {hotDesign ? <p className="upload-ok">Hot cup uploaded: {hotDesign.fileName}</p> : null}
          {coldDesign ? <p className="upload-ok">Cold cup uploaded: {coldDesign.fileName}</p> : null}
          {hasSameDesign ? <p className="upload-ok">Same design is applied to both cup templates.</p> : null}
          <label className="range-field">
            Hot cup logo size
            <input type="range" min={10} max={70} value={hotDesign?.size ?? 34} disabled={!hotDesign} onChange={(event) => update("hot", { size: Number(event.target.value) })} />
          </label>
          <label className="range-field">
            Hot cup rotation
            <input type="range" min={-30} max={30} value={hotDesign?.rotation ?? 0} disabled={!hotDesign} onChange={(event) => update("hot", { rotation: Number(event.target.value) })} />
          </label>
          <label className="range-field">
            Cold cup logo size
            <input type="range" min={10} max={70} value={coldDesign?.size ?? 34} disabled={!coldDesign} onChange={(event) => update("cold", { size: Number(event.target.value) })} />
          </label>
          <label className="range-field">
            Cold cup rotation
            <input type="range" min={-30} max={30} value={coldDesign?.rotation ?? 0} disabled={!coldDesign} onChange={(event) => update("cold", { rotation: Number(event.target.value) })} />
          </label>
        </>
      ) : null}
    </div>
  );
}
