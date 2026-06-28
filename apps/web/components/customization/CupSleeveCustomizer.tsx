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
  reader.onload = () => callback({ fileName: file.name, dataUrl: String(reader.result), size: 26, rotation: 0, x: 50, y: 45 });
  reader.readAsDataURL(file);
}

export function CupSleeveCustomizer({ serviceDates, designs, activeDateId, onActiveDate, onDesigns }: Props) {
  const activeKey = serviceDates.some((date) => date.id === activeDateId) ? activeDateId : serviceDates[0]?.id ?? "";
  const active = designs[activeKey];

  function update(patch: Partial<CustomizationDesign>) {
    if (!active) return;
    onDesigns({ ...designs, [activeKey]: { ...active, ...patch } });
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
        <div className="sleeve-shape">
          {active ? (
            <img
              src={active.dataUrl}
              alt="Cup sleeve design"
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
            <input type="range" min={10} max={80} value={active.size} onChange={(event) => update({ size: Number(event.target.value) })} />
          </label>
          <label className="range-field">
            Horizontal placement
            <input type="range" min={10} max={90} value={active.x} onChange={(event) => update({ x: Number(event.target.value) })} />
          </label>
          <label className="range-field">
            Vertical placement
            <input type="range" min={20} max={80} value={active.y} onChange={(event) => update({ y: Number(event.target.value) })} />
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
