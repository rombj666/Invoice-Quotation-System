"use client";

import { useEffect, useMemo, useState } from "react";
import { apiBaseUrl } from "../../lib/api-client";
import { customizationPhysicalSize, physicalSizeLabels } from "../../lib/customization-physical-size";
import { mergeCustomizationPreview } from "../../lib/customization-renderer";
import type { CustomizationByDate, CustomizationDesign } from "../../types/customization";
import type { InvoiceDetails } from "../../types/invoice";
import styles from "./ArtworkComparison.module.css";

type Kind = "cart" | "sleeve";
type ArtworkFile = NonNullable<InvoiceDetails["customizationUrls"]>[number];
type Source = { url: string; name: string; geometry: Record<string, unknown> };
type Group = { key: string; sources: Source[]; finalUrl?: string; finalName?: string; design?: CustomizationDesign; physicalSize?: unknown };

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasGeometry(value: Record<string, unknown>, kind: Kind) {
  const finite = (field: unknown) => typeof field === "number" && Number.isFinite(field);
  if (kind === "sleeve") return [value.size, value.x, value.y, value.rotation].every(finite);
  return (finite(value.widthRatio) || finite(value.size))
    && (finite(value.centerXRatio) || finite(value.x)) && (finite(value.centerYRatio) || finite(value.y));
}

function groupsFor(kind: Kind, designs: CustomizationByDate, files: ArtworkFile[]): Group[] {
  const grouped = new Map<string, { originals: ArtworkFile[]; final?: ArtworkFile; metadata: Record<string, unknown> }>();
  for (const file of files) {
    const metadata = record(file.metadata);
    const original = metadata.originalArtwork === true;
    const key = original ? file.designKey.replace(/:\d+$/, "") : file.designKey;
    const group = grouped.get(key) ?? { originals: [], metadata: {} };
    if (original) group.originals.push(file);
    else if (/^final-(cart|sleeve)-/i.test(file.fileName) || metadata.finalDesign === true) group.final = file;
    else group.originals.push(file);
    group.metadata = { ...group.metadata, ...metadata };
    grouped.set(key, group);
  }

  return [...new Set([...Object.keys(designs), ...grouped.keys()])].flatMap((key): Group[] => {
    const stored = grouped.get(key);
    const fallback = { ...stored?.metadata, ...designs[key] };
    const physicalSize = stored?.metadata.physicalSize ?? fallback;
    const savedFinal = stored?.final;
    const embeddedFinal = /^final-(cart|sleeve)-/i.test(String(fallback.fileName ?? "")) && typeof fallback.dataUrl === "string" ? fallback.dataUrl : undefined;
    const finalUrl = savedFinal?.fileUrl ?? embeddedFinal;
    const finalName = savedFinal?.fileName ?? String(fallback.fileName ?? `final-${kind}-${key}.webp`);
    const savedLayers = Array.isArray(fallback.logos) ? fallback.logos.map(record) : [fallback];
    let sources: Source[];
    if (stored?.originals.length) {
      sources = [...stored.originals].sort((a, b) => Number(a.designKey.match(/:(\d+)$/)?.[1] ?? 0) - Number(b.designKey.match(/:(\d+)$/)?.[1] ?? 0)).map((file, index) => {
        const metadata = record(file.metadata);
        return { url: file.fileUrl, name: file.fileName, geometry: { ...savedLayers[index], ...metadata, ...record(metadata.geometry) } };
      });
    } else {
      sources = savedLayers.flatMap((layer): Source[] => {
        const source = layer.originalDataUrl ?? layer.dataUrl;
        if (typeof source !== "string" || source === finalUrl) return [];
        return [{ url: source, name: String(layer.fileName ?? "Original artwork"), geometry: layer }];
      });
    }
    if (!sources.length && !finalUrl) return [];
    const expectedLayers = typeof stored?.metadata.layerCount === "number" ? stored.metadata.layerCount : savedLayers.length;
    const canRender = sources.length > 0 && sources.length >= expectedLayers && sources.every((source) => hasGeometry(source.geometry, kind));
    const design = canRender ? {
      ...sources[0].geometry, fileName: sources[0].name, dataUrl: sources[0].url, originalDataUrl: sources[0].url,
      ...(kind === "sleeve" ? { logos: sources.map((source, index) => ({ ...source.geometry, id: String(index), fileName: source.name, dataUrl: source.url, originalDataUrl: source.url })) } : {})
    } as CustomizationDesign : undefined;
    return [{ key, sources, finalUrl, finalName, design, physicalSize }];
  });
}

function ImageFile({ url, name, alt }: { url: string; name: string; alt: string }) {
  const [localUrl, setLocalUrl] = useState("");
  useEffect(() => {
    if (!url.startsWith("data:")) return;
    let active = true;
    let objectUrl = "";
    fetch(url).then((response) => response.blob()).then((blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setLocalUrl(objectUrl);
    }).catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  const openUrl = url.startsWith("data:") ? localUrl : url;
  const downloadUrl = url.startsWith("http") ? `${apiBaseUrl}/api/files/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(name)}` : openUrl;
  return <div className={styles.file}>
    <img src={url} alt={alt} />
    <p>{name}</p>
    {openUrl ? <div className="admin-file-actions"><a className="admin-file-link" href={openUrl} target="_blank" rel="noopener noreferrer">Open</a><a className="admin-file-link" href={downloadUrl} download={name}>Download</a></div> : null}
  </div>;
}

function DesignComparison({ group, kind }: { group: Group; kind: Kind }) {
  const [rendered, setRendered] = useState<{ url: string; name: string }>();
  const [error, setError] = useState("");
  useEffect(() => {
    setRendered(undefined);
    setError("");
    if (group.finalUrl || !group.design) return;
    let active = true;
    // The same compositor used by the existing customization preview; saved data is never changed.
    mergeCustomizationPreview(kind, group.design).then((result) => {
      if (active) setRendered({ url: result.dataUrl, name: result.fileName });
    }).catch(() => { if (active) setError("Unable to render the saved artwork. The source image or template could not be loaded."); });
    return () => { active = false; };
  }, [group, kind]);
  const final = group.finalUrl ? { url: group.finalUrl, name: group.finalName! } : rendered;
  return <section className={styles.design}>
    <h3>{group.key === "shared" ? "All service dates" : group.key}</h3>
    {physicalSizeLabels(group.physicalSize, customizationPhysicalSize(kind)).map((label) => <p key={label}>{label}</p>)}
    <div className={styles.columns}>
      <div><h4>ORIGINAL ARTWORK</h4>{group.sources.length ? group.sources.map((source, index) => <ImageFile key={`${source.url}-${index}`} url={source.url} name={source.name} alt={`Original artwork layer ${index + 1}`} />) : <p>The original source image was not retained with this submission.</p>}</div>
      <div><h4>FINAL DESIGN</h4>{final ? <ImageFile url={final.url} name={final.name} alt={`Final ${kind === "cart" ? "coffee cart" : "cup sleeve"} design`} /> : <p role={error ? "alert" : undefined}>{error || (group.design ? "Rendering saved design…" : "Final design unavailable: this submission did not retain its positioning/layer data or a final composite.")}</p>}</div>
    </div>
  </section>;
}

export function ArtworkComparison({ kind, designs, urls }: { kind: Kind; designs?: CustomizationByDate; urls?: InvoiceDetails["customizationUrls"] }) {
  const groups = useMemo(() => groupsFor(kind, designs ?? {}, (urls ?? []).filter((file) => file.type === (kind === "cart" ? "CART_DESIGN" : "CUP_SLEEVE"))), [kind, designs, urls]);
  return <section><h2>{kind === "cart" ? "Coffee Cart Artwork" : "Cup Sleeve Artwork"}</h2>{groups.length ? groups.map((group) => <DesignComparison key={group.key} group={group} kind={kind} />) : <p>No design uploaded.</p>}</section>;
}
