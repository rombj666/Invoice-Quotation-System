"use client";

import { MENU_PHYSICAL } from "../../lib/customization-layout";

import type { InvoiceUploadFile } from "../../types/invoice";
import { CUSTOMIZATION_ASSETS } from "../../lib/customization-assets";
import { LATTE_PHYSICAL } from "../../lib/customization-layout";

export function ArtworkCustomizer({ kind, file, onFile }: { kind: "menu" | "latte"; file?: InvoiceUploadFile; onFile: (file?: InvoiceUploadFile) => void }) {
  const menu = kind === "menu";
  const read = (upload: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const originalDataUrl = String(reader.result);
      if (menu) return onFile({ fileName: upload.name, mimeType: upload.type, dataUrl: originalDataUrl, originalDataUrl });
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1000; canvas.height = Math.round(canvas.width * LATTE_PHYSICAL.artworkHeightCm / LATTE_PHYSICAL.artworkWidthCm);
        const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
        const width = image.naturalWidth * scale; const height = image.naturalHeight * scale;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let index = 0; index < pixels.data.length; index += 4) {
          const gray = pixels.data[index] * 0.299 + pixels.data[index + 1] * 0.587 + pixels.data[index + 2] * 0.114;
          const bw = gray >= 160 ? 255 : 0;
          pixels.data[index] = bw; pixels.data[index + 1] = bw; pixels.data[index + 2] = bw;
        }
        context.putImageData(pixels, 0, 0);
        onFile({ fileName: upload.name, mimeType: "image/png", dataUrl: canvas.toDataURL("image/png"), finalDataUrl: canvas.toDataURL("image/png"), originalDataUrl, physicalSize: { diameterCm: LATTE_PHYSICAL.printDiameterCm, artworkWidthCm: LATTE_PHYSICAL.artworkWidthCm, artworkHeightCm: LATTE_PHYSICAL.artworkHeightCm, actualArtworkSizeCm: { width: width / canvas.width * LATTE_PHYSICAL.artworkWidthCm, height: height / canvas.height * LATTE_PHYSICAL.artworkHeightCm } }, actualArtworkSizeCm: { width: width / canvas.width * LATTE_PHYSICAL.artworkWidthCm, height: height / canvas.height * LATTE_PHYSICAL.artworkHeightCm } });
      };
      image.src = originalDataUrl;
    };
    reader.readAsDataURL(upload);
  };

  if (menu) {
    return (
      <div className="customize-step customize-menu-step">
        <div className="customize-preview-pane">
          <h2>Custom Menu</h2>
          <p className="step-copy">Prepare artwork on an A4 portrait canvas ({MENU_PHYSICAL.width} × {MENU_PHYSICAL.height} {MENU_PHYSICAL.unit}).</p>
          <div className="artwork-editor-preview a4">{file?.dataUrl?.startsWith("data:image/") ? <img src={file.dataUrl} alt="Artwork preview" /> : <span>A4 · {MENU_PHYSICAL.width} × {MENU_PHYSICAL.height} {MENU_PHYSICAL.unit}</span>}</div>
        </div>
        <div className="customize-controls-pane">
          <label className="upload-box"><strong>{file ? "Replace artwork" : "Upload artwork"}</strong><span>PNG, JPG or PDF</span><input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(event) => { const upload = event.target.files?.[0]; if (upload) read(upload); }} /></label>
          {file ? <><p className="upload-ok">Uploaded: {file.fileName}</p><button type="button" className="secondary-mini-button" onClick={() => onFile(undefined)}>Remove</button></> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="customize-step customize-latte-step">
      <div className="customize-preview-pane">
        <h2>Latte Art / Print Pen</h2>
        <p className="step-copy">Upload the artwork to be printed on the drink surface.</p>
        <div className="latte-print-preview">
          <span className="latte-print-circle-label">{LATTE_PHYSICAL.printDiameterCm} cm print area</span>
          <div className="latte-artwork-box">
            {file?.dataUrl?.startsWith("data:image/") ? <img src={file.dataUrl} alt="Artwork preview" /> : <span className="latte-artwork-placeholder">Artwork area</span>}
            <small className="latte-artwork-label">Maximum artwork height: {LATTE_PHYSICAL.artworkHeightCm} cm</small>
          </div>
        </div>
        {file ? <p className="upload-ok">Uploaded: {file.fileName} · Maximum artwork height: {LATTE_PHYSICAL.artworkHeightCm} cm</p> : null}
      </div>

      <div className="customize-controls-pane">
        <label className="upload-box"><strong>{file ? "Replace artwork" : "Upload artwork"}</strong><span>PNG or JPG · black and white output</span><input type="file" accept="image/png,image/jpeg" onChange={(event) => { const upload = event.target.files?.[0]; if (upload) read(upload); }} /></label>
        {file ? <button type="button" className="secondary-mini-button" onClick={() => onFile(undefined)}>Remove</button> : null}

        <div className="latte-guidance">
          <p className="latte-guidance-copy">Use simple black artwork with strong, clear shapes. Avoid white artwork and highly detailed designs.</p>
          <div className="latte-example-row">
            <div className="latte-example-card good">
              <img src={CUSTOMIZATION_ASSETS.latteGoodExampleUrl} alt="GOOD example: simple black logo" />
              <div><strong>GOOD EXAMPLE ✓</strong><span>Simple black logo</span></div>
            </div>
            <div className="latte-example-card avoid">
              <img src={CUSTOMIZATION_ASSETS.latteAvoidExampleUrl} alt="AVOID example: complex illustration" />
              <div><strong>AVOID ✕</strong><span>Complex illustration</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
