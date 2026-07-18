"use client";

import type { InvoiceDetails } from "../../types/invoice";
import { Card } from "../common/Card";
import { InvoicePreview } from "./InvoicePreview";

type StoredFile = { fileUrl: string; fileName: string; mimeType?: string; designKey?: string };

function isImage(file: StoredFile) {
  return file.mimeType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(file.fileUrl);
}

function designLabel(designKey?: string) {
  if (!designKey) return "Final file";
  const [key, cupType] = designKey.split(":");
  const base = key === "shared"
    ? "Shared design"
    : /^\d{4}-\d{2}-\d{2}$/.test(key)
      ? key.split("-").reverse().join("/")
      : key.replaceAll("-", " ");
  return cupType ? `${base} · ${cupType === "hot" ? "Hot cup" : "Cold cup"}` : base;
}

function FileCard({ title, file }: { title: string; file: StoredFile }) {
  return (
    <article className="readonly-file-card">
      <div className="readonly-file-frame">
        {isImage(file) ? <img src={file.fileUrl} alt={`${title} ${designLabel(file.designKey)}`} /> : <div className="readonly-file-placeholder">Final file</div>}
      </div>
      <strong>{designLabel(file.designKey)}</strong>
      <span>{file.fileName}</span>
      <span>{file.mimeType ?? file.fileName.split(".").pop()?.toUpperCase() ?? "File"}</span>
      <div className="readonly-file-actions">
        <a href={file.fileUrl} target="_blank" rel="noreferrer">Open</a>
        <a href={file.fileUrl} download={file.fileName}>Download</a>
      </div>
    </article>
  );
}

function FileGroup({ title, files }: { title: string; files: StoredFile[] }) {
  if (!files.length) return null;
  return (
    <section className="readonly-file-section">
      <h2>{title}</h2>
      <div className="readonly-custom-grid">
        {files.map((file, index) => <FileCard title={title} file={file} key={`${file.fileUrl}-${index}`} />)}
      </div>
    </section>
  );
}

function StickerGroup({ files }: { files: StoredFile[] }) {
  if (!files.length) return null;
  const groups = files.reduce<Record<string, StoredFile[]>>((result, file) => {
    const key = file.designKey?.split(":")[0] ?? "shared";
    result[key] = [...(result[key] ?? []), file];
    return result;
  }, {});
  return (
    <section className="readonly-file-section">
      <h2>Cup Sticker Design</h2>
      <div className="readonly-sticker-groups">
        {Object.entries(groups).map(([dateKey, group]) => (
          <div className="readonly-sticker-group" key={dateKey}>
            <h3>{designLabel(dateKey)}</h3>
            <div className="readonly-custom-grid">
              {group.map((file, index) => <FileCard title="Cup Sticker Design" file={file} key={`${file.fileUrl}-${index}`} />)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SubmittedInvoiceView({ invoice }: { invoice: InvoiceDetails }) {
  const customizations = invoice.customizationUrls ?? [];
  const carts = customizations.filter((file) => file.type === "CART_DESIGN");
  const sleeves = customizations.filter((file) => file.type === "CUP_SLEEVE");
  const stickers = customizations.filter((file) => file.type === "CUP_STICKER");
  const menus: StoredFile[] = [...(invoice.invoiceFiles ?? [])];
  if (invoice.customMenuFile?.fileUrl && !menus.some((file) => file.fileUrl === invoice.customMenuFile?.fileUrl)) {
    menus.push({
      fileUrl: invoice.customMenuFile.fileUrl,
      fileName: invoice.customMenuFile.fileName,
      mimeType: invoice.customMenuFile.mimeType
    });
  }

  return (
    <main className="hc-page invoice-page submitted-invoice-page">
      <div className="team-topbar">Hour Coffee - Invoice</div>
      <Card className="wide-card invoice-preview-card">
        <h2 className="screen-only">Invoice Summary</h2>
        <InvoicePreview invoiceNo={invoice.invoiceNo} quotation={invoice.quotation} invoice={invoice} />
        <FileGroup title="Cart Design" files={carts} />
        <FileGroup title="Custom Menu" files={menus} />
        <FileGroup title="Cup Sleeve Design" files={sleeves} />
        <StickerGroup files={stickers} />
      </Card>
    </main>
  );
}
