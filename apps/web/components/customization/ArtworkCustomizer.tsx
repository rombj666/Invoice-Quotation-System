"use client";

import type { InvoiceUploadFile } from "../../types/invoice";
import { CUSTOMIZATION_ASSETS } from "../../lib/customization-assets";
import { LATTE_PHYSICAL } from "../../lib/customization-layout";

export function ArtworkCustomizer({ kind, file, onFile }: { kind: "menu" | "latte"; file?: InvoiceUploadFile; onFile: (file?: InvoiceUploadFile) => void }) {
  const menu = kind === "menu";
  const read = (upload: File) => { const reader = new FileReader(); reader.onload = () => onFile({ fileName: upload.name, mimeType: upload.type, dataUrl: String(reader.result) }); reader.readAsDataURL(upload); };

  if (menu) {
    return (
      <div className="customize-step customize-menu-step">
        <div className="customize-preview-pane">
          <h2>Custom Menu</h2>
          <p className="step-copy">Prepare artwork on an A4 portrait canvas (21 × 29.7 cm).</p>
          <div className="artwork-editor-preview a4">{file?.dataUrl?.startsWith("data:image/") ? <img src={file.dataUrl} alt="Artwork preview" /> : <span>A4 · 21 × 29.7 cm</span>}</div>
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
            <small className="latte-artwork-label">{LATTE_PHYSICAL.artworkWidthCm} × {LATTE_PHYSICAL.artworkHeightCm} cm Artwork Area</small>
          </div>
        </div>
        {file ? <p className="upload-ok">Uploaded: {file.fileName} · Auto-fitted to {LATTE_PHYSICAL.artworkWidthCm} × {LATTE_PHYSICAL.artworkHeightCm} cm area</p> : null}
      </div>

      <div className="customize-controls-pane">
        <label className="upload-box"><strong>{file ? "Replace artwork" : "Upload artwork"}</strong><span>PNG, JPG or PDF</span><input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(event) => { const upload = event.target.files?.[0]; if (upload) read(upload); }} /></label>
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
