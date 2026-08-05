import { apiBaseUrl } from "../../lib/api-client";

type Props = {
  documentLabel: "Quotation PDF" | "Invoice PDF";
  fileUrl?: string;
  fileName: string;
};

export function DocumentCard({ documentLabel, fileUrl, fileName }: Props) {
  const downloadUrl = fileUrl
    ? `${apiBaseUrl}/api/files/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(fileName)}`
    : "";

  return (
    <section>
      <h3>Documents</h3>
      <p><strong>{documentLabel}</strong></p>
      {fileUrl ? (
        <div className="admin-file-actions">
          <a className="admin-file-link" href={fileUrl} target="_blank" rel="noopener noreferrer">View PDF</a>
          <a className="admin-file-link" href={downloadUrl} target="_blank" rel="noopener noreferrer">Download PDF</a>
        </div>
      ) : (
        <p>{documentLabel} not available.</p>
      )}
    </section>
  );
}
