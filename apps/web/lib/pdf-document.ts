type PdfOptions = {
  filename: string;
};

export async function generatePdfBlob(elementId: string, { filename }: PdfOptions): Promise<Blob> {
  const source = document.getElementById(elementId);
  if (!source) throw new Error("The PDF document is not available. Please try again.");

  await document.fonts?.ready;
  const exportRoot = document.createElement("div");
  exportRoot.className = "pdf-export-root";
  const documentClone = source.cloneNode(true) as HTMLElement;
  documentClone.removeAttribute("id");
  exportRoot.appendChild(documentClone);
  document.body.appendChild(exportRoot);

  try {
    const { default: html2pdf } = await import("html2pdf.js");
    return await html2pdf()
      .set({
        filename,
        ...(elementId === "quotationPreview" ? { pagebreak: { mode: ["css", "legacy"], before: ".quotation-page-two", avoid: ["tr", "thead", ".invoice-totals"] } } : {}),
        margin: 6,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      })
      .from(documentClone)
      .outputPdf("blob");
  } finally {
    exportRoot.remove();
  }
}

export function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
