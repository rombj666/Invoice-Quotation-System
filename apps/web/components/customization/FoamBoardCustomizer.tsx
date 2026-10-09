"use client";

import type { PointerEvent } from "react";
import { useRef } from "react";
import type { CustomizationByDate, CustomizationDesign } from "../../types/customization";
import type { CustomizationMode, ServiceDate } from "../../types/quotation";
import { FOAM_BOARD_MAX_ARTWORK_CM, FOAM_BOARD_PHYSICAL_CM, formatCustomizationDate, normalizeFoamBoardDesign } from "../../lib/customization-layout";

type Props = { mode: CustomizationMode; serviceDates: ServiceDate[]; designs: CustomizationByDate; activeDate: string; onActiveDate: (date: string) => void; onDesigns: (designs: CustomizationByDate) => void };

function readImage(file: File, onDesign: (design: CustomizationDesign) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result);
    const image = new Image();
    image.onload = () => onDesign(normalizeFoamBoardDesign({ fileName: file.name, dataUrl, originalDataUrl: dataUrl, size: 50, widthRatio: 0.5, rotation: 0, x: 50, y: 50, centerXRatio: 0.5, centerYRatio: 0.5, aspectRatio: image.naturalHeight / Math.max(1, image.naturalWidth) }));
    image.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

export function FoamBoardCustomizer({ mode, serviceDates, designs, activeDate, onActiveDate, onDesigns }: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dates = serviceDates.map((date) => date.serviceDate);
  const selectedDate = dates.includes(activeDate) ? activeDate : dates[0] ?? "";
  const activeKey = mode === "same" ? "shared" : selectedDate;
  const active = designs[activeKey] ? normalizeFoamBoardDesign(designs[activeKey]!) : undefined;

  function clampCenter(center: number, halfSize: number) { return Math.min(1 - halfSize, Math.max(halfSize, center)); }
  function updatePosition(event: PointerEvent<HTMLDivElement>) {
    if (!active || !boardRef.current || event.buttons !== 1) return;
    const bounds = boardRef.current.getBoundingClientRect();
    const widthRatio = active.widthRatio ?? active.size / 100;
    const heightRatio = active.heightRatio ?? widthRatio * (active.aspectRatio ?? 1) * FOAM_BOARD_PHYSICAL_CM.width / FOAM_BOARD_PHYSICAL_CM.height;
    const centerXRatio = clampCenter((event.clientX - bounds.left) / bounds.width, widthRatio / 2);
    const centerYRatio = clampCenter((event.clientY - bounds.top) / bounds.height, heightRatio / 2);
    onDesigns({ ...designs, [activeKey]: normalizeFoamBoardDesign({ ...active, centerXRatio, centerYRatio, x: centerXRatio * 100, y: centerYRatio * 100 }) });
  }
  function updateSize(widthRatio: number) {
    if (!active) return;
    onDesigns({ ...designs, [activeKey]: normalizeFoamBoardDesign({ ...active, widthRatio, size: widthRatio * 100 }) });
  }

  const aspect = active?.aspectRatio ?? 1;
  const maxWidth = Math.min(FOAM_BOARD_MAX_ARTWORK_CM.width / FOAM_BOARD_PHYSICAL_CM.width, FOAM_BOARD_MAX_ARTWORK_CM.height / (FOAM_BOARD_PHYSICAL_CM.height * aspect));
  const minWidth = Math.min(0.02, maxWidth);

  return <div className="customize-step customize-foam-board-step">
    <div className="customize-preview-pane">
      <h2>Foam Board Design</h2>
      <p className="step-copy">Preview your design on the {FOAM_BOARD_PHYSICAL_CM.width} × {FOAM_BOARD_PHYSICAL_CM.height} cm board.</p>
      <div className="foam-board-preview" ref={boardRef} onPointerMove={updatePosition} style={{ aspectRatio: `${FOAM_BOARD_PHYSICAL_CM.width} / ${FOAM_BOARD_PHYSICAL_CM.height}` }}>
        {active ? <img src={active.originalDataUrl ?? active.dataUrl} alt="Foam board artwork preview" draggable={false} style={{ width: `${(active.widthRatio ?? 0) * 100}%`, left: `${(active.centerXRatio ?? 0.5) * 100}%`, top: `${(active.centerYRatio ?? 0.5) * 100}%`, transform: "translate(-50%, -50%)" }} /> : <span>{FOAM_BOARD_PHYSICAL_CM.width} × {FOAM_BOARD_PHYSICAL_CM.height} cm Foam Board</span>}
      </div>
    </div>
    <div className="customize-controls-pane">
      <p className="step-copy">Maximum artwork: {FOAM_BOARD_MAX_ARTWORK_CM.width} × {FOAM_BOARD_MAX_ARTWORK_CM.height} cm. Drag to reposition; artwork stays on the board.</p>
      {mode === "per-date" && serviceDates.length > 1 ? <label className="hc-field"><span>Editing design</span><select className="design-select" value={selectedDate} onChange={(event) => onActiveDate(event.target.value)}>{serviceDates.map((date) => <option value={date.serviceDate} key={date.serviceDate}>{formatCustomizationDate(date.serviceDate)}</option>)}</select></label> : null}
      <label className="upload-box"><strong>{active ? "Replace design" : "Upload design"}</strong><span>PNG or JPG</span><input type="file" accept="image/png,image/jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImage(file, (design) => onDesigns({ ...designs, [activeKey]: design })); event.currentTarget.value = ""; }} /></label>
      {active ? <><p className="upload-ok">Original: {active.fileName}</p><label className="range-field">Artwork width<input aria-label="Foam board artwork width" type="range" min={minWidth} max={maxWidth} step={0.001} value={Math.min(maxWidth, Math.max(minWidth, active.widthRatio ?? minWidth))} onChange={(event) => updateSize(Number(event.target.value))} /></label><div className="mini-summary">Artwork size: {active.widthCm?.toFixed(1)} cm × {active.heightCm?.toFixed(1)} cm</div></> : null}
    </div>
  </div>;
}
