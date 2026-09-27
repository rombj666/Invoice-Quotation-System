"use client";

import type { InvoiceUploadFile } from "../../types/invoice";

export function ArtworkCustomizer({ kind, file, onFile }: { kind: "menu" | "latte"; file?: InvoiceUploadFile; onFile: (file?: InvoiceUploadFile) => void }) {
  const menu = kind === "menu";
  const read = (upload: File) => { const reader = new FileReader(); reader.onload = () => onFile({ fileName: upload.name, mimeType: upload.type, dataUrl: String(reader.result) }); reader.readAsDataURL(upload); };
  return <div><h2>{menu ? "Custom Menu" : "Latte Art / Print Pen"}</h2><p className="step-copy">{menu ? "Prepare artwork on an A4 portrait canvas (21 × 29.7 cm)." : "Upload the artwork to be printed on the drink surface."}</p>
    <div className={`artwork-editor-preview ${menu ? "a4" : "latte"}`}>{file?.dataUrl?.startsWith("data:image/") ? <img src={file.dataUrl} alt="Artwork preview" /> : <span>{menu ? "A4 · 21 × 29.7 cm" : "Print area · 8 cm diameter"}</span>}</div>
    <label className="upload-box"><strong>{file ? "Replace artwork" : "Upload artwork"}</strong><span>PNG, JPG or PDF</span><input type="file" accept="image/png,image/jpeg,application/pdf" onChange={(event) => { const upload = event.target.files?.[0]; if (upload) read(upload); }} /></label>
    {file ? <><p className="upload-ok">Uploaded: {file.fileName}</p><button type="button" className="secondary-mini-button" onClick={() => onFile(undefined)}>Remove</button></> : null}
  </div>;
}
