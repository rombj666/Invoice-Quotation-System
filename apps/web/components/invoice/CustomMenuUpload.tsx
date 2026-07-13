"use client";

import type { InvoiceUploadFile } from "../../types/invoice";

type Props = {
  file?: InvoiceUploadFile;
  onFile: (file?: InvoiceUploadFile) => void;
};

const acceptedTypes = ".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isImage(file: InvoiceUploadFile): boolean {
  return Boolean(file.mimeType?.startsWith("image/") || file.dataUrl?.startsWith("data:image/"));
}

function fileTypeLabel(file: InvoiceUploadFile): string {
  if (file.mimeType) return file.mimeType.replace("application/", "").replace("image/", "").toUpperCase();
  return file.fileName.split(".").pop()?.toUpperCase() || "FILE";
}

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
          {isImage(file) && file.dataUrl ? <img className="custom-menu-preview" src={file.dataUrl} alt={`Preview of ${file.fileName}`} /> : null}
          {!isImage(file) ? <p className="custom-menu-file-type">File type: {fileTypeLabel(file)}</p> : null}
          <button type="button" onClick={() => onFile(undefined)}>
            Remove file
          </button>
        </div>
      ) : null}
    </div>
  );
}
