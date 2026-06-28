"use client";

import type { CustomizationByDate, CustomizationDesign } from "../../types/customization";
import type { ServiceDate } from "../../types/quotation";
import { formatShortDate } from "../../lib/formatters";

type Props = {
  serviceDates: ServiceDate[];
  designs: CustomizationByDate;
  activeDateId: string;
  onActiveDate: (id: string) => void;
  onDesigns: (designs: CustomizationByDate) => void;
};

function readFile(file: File, callback: (design: CustomizationDesign) => void) {
  const reader = new FileReader();
  reader.onload = () => callback({ fileName: file.name, dataUrl: String(reader.result), size: 34, rotation: 0, x: 50, y: 50 });
  reader.readAsDataURL(file);
}

export function CupStickerCustomizer({ serviceDates, designs, activeDateId, onActiveDate, onDesigns }: Props) {
  const activeKey = serviceDates.some((date) => date.id === activeDateId) ? activeDateId : serviceDates[0]?.id ?? "";
  const active = designs[activeKey];

  function update(patch: Partial<CustomizationDesign>) {
    if (!active) return;
    onDesigns({ ...designs, [activeKey]: { ...active, ...patch } });
  }

  const logo = active ? <img src={active.dataUrl} alt="Cup sticker logo" style={{ width: `${active.size}%`, transform: `rotate(${active.rotation}deg)` }} /> : <span>Logo</span>;

  return (
    <div>
      <h2>Cup Sticker Logo</h2>
      <p className="step-copy">Logo appears on both the 8 oz hot cup and 12 oz ice cup.</p>
      {serviceDates.length > 1 ? (
        <select className="design-select" value={activeKey} onChange={(event) => onActiveDate(event.target.value)}>
          {serviceDates.map((date, index) => (
            <option value={date.id} key={date.id}>
              Design {index + 1} - {formatShortDate(date.serviceDate)}
            </option>
          ))}
        </select>
      ) : null}
      <div className="cup-preview-row">
        <div className="cup-preview hot">
          <strong>8 oz Hot</strong>
          <div className="cup-shape">{logo}</div>
        </div>
        <div className="cup-preview ice">
          <strong>12 oz Ice</strong>
          <div className="cup-shape">{logo}</div>
        </div>
      </div>
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
            <input type="range" min={10} max={70} value={active.size} onChange={(event) => update({ size: Number(event.target.value) })} />
          </label>
          <label className="range-field">
            Rotation
            <input type="range" min={-30} max={30} value={active.rotation} onChange={(event) => update({ rotation: Number(event.target.value) })} />
          </label>
        </>
      ) : null}
    </div>
  );
}
