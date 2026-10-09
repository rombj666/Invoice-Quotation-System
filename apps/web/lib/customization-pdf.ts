import { downloadPdfBlob, generatePdfBlob } from "./pdf-document";

let nextId = 0;

export async function downloadCustomizationPdf(input: { imageUrl: string; filename: string; designType: string; identifier: string; physicalDimensions: string[] }) {
  const id = `customization-production-pdf-${++nextId}`;
  const root = document.createElement("div");
  root.className = "invoice-card hc-production-sheet";
  root.id = id;
  const heading = document.createElement("h1");
  heading.className = "invoice-title";
  heading.textContent = input.designType;
  const imageWrap = document.createElement("div");
  imageWrap.className = "hc-production-artwork";
  const image = document.createElement("img");
  image.src = input.imageUrl;
  if (/^https?:/i.test(input.imageUrl)) image.crossOrigin = "anonymous";
  image.alt = `${input.designType} final design`;
  imageWrap.appendChild(image);
  const info = document.createElement("section");
  info.className = "invoice-section";
  const identifier = document.createElement("p");
  identifier.textContent = `Design identifier: ${input.identifier}`;
  info.appendChild(identifier);
  for (const label of input.physicalDimensions) {
    const row = document.createElement("p");
    row.textContent = label;
    info.appendChild(row);
  }
  root.append(heading, imageWrap, info);
  document.body.appendChild(root);
  try {
    downloadPdfBlob(await generatePdfBlob(id, { filename: input.filename }), input.filename);
  } finally {
    root.remove();
  }
}
