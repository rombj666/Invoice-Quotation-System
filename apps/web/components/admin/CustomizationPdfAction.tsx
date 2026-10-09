"use client";

import { downloadCustomizationPdf } from "../../lib/customization-pdf";

export function CustomizationPdfAction({ imageUrl, filename, designType, identifier, physicalDimensions }: { imageUrl: string; filename: string; designType: string; identifier: string; physicalDimensions: string[] }) {
  return <button className="admin-file-link" type="button" onClick={() => void downloadCustomizationPdf({ imageUrl, filename, designType, identifier, physicalDimensions })}>Download PDF</button>;
}
