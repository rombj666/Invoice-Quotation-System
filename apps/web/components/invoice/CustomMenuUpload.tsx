"use client";

import type { InvoiceUploadFile } from "../../types/invoice";

type Props = {
  file?: InvoiceUploadFile;
  onFile: (file?: InvoiceUploadFile) => void;
};

const acceptedTypes = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function CustomMenuUpload({ file, onFile }: Props) {
  function readFile(upload: File) {
    const reader = new FileReader();
    reader.onload = () => {
      onFile({
        fileName: upload.name,
        mimeType: upload.type || "application/octet-stream",
        dataUrl: String(reader.result)
      });
    };
    reader.readAsDataURL(upload);
  }

  return (
    <div>
      <h2>Custom Menu File</h2>
      <p className="step-copy">Upload your custom menu file for printing. PDF, PNG, JPG, WebP, or document file accepted.</p>
      <label className="upload-box">
        <strong>{file ? "Replace custom menu file" : "Tap to upload custom menu file"}</strong>
        <span>PDF, PNG, JPG, WebP, DOC or DOCX</span>
        <input
          type="file"
          accept={acceptedTypes}
          onChange={(event) => {
            const upload = event.target.files?.[0];
            if (upload) readFile(upload);
          }}
        />
      </label>
      {file ? (
        <div className="file-upload-summary">
          <p className="upload-ok">Uploaded: {file.fileName}</p>
          <button type="button" onClick={() => onFile(undefined)}>
            Remove file
          </button>
        </div>
      ) : null}
    </div>
  );
}
