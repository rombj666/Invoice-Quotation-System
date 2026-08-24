"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { loadAdminPackages, updatePackage } from "../../../lib/packages";
import type { FixedPackageDisplay } from "../../../types/quotation";

type DisplayDraft = { name: string; shortDescription: string };

export default function PackageSettingsPage() {
  const [packages, setPackages] = useState<FixedPackageDisplay[]>([]);
  const [editing, setEditing] = useState<FixedPackageDisplay | null>(null);
  const [draft, setDraft] = useState<DisplayDraft>({ name: "", shortDescription: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    setError("");
    try { setPackages(await loadAdminPackages()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load package settings."); }
  }

  useEffect(() => { void refresh(); }, []);

  function openEditor(item: FixedPackageDisplay) {
    setEditing(item);
    setDraft({ name: item.name, shortDescription: item.shortDescription });
    setError("");
    setSuccess("");
  }

  async function save() {
    if (!editing) return;
    if (!draft.name.trim() || !draft.shortDescription.trim()) return setError("Display title and description are required.");
    setBusy(true);
    setError("");
    try {
      const saved = await updatePackage(editing.code, { name: draft.name.trim(), shortDescription: draft.shortDescription.trim() });
      setPackages((current) => current.map((item) => item.code === saved.code ? saved : item));
      setEditing(null);
      setSuccess(`${saved.name} display details updated.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update package display details.");
    } finally { setBusy(false); }
  }

  return <main className="admin-page">
    <Card className="admin-card package-settings-admin">
      <header className="admin-page-header"><div><p className="admin-eyebrow">Quotation Setup</p><h1>Package Settings</h1><p>The four package types and all financial rules are fixed. You may edit customer-facing titles and descriptions only.</p></div></header>
      {error && !editing ? <p className="error">{error}</p> : null}
      {success ? <div className="ok-summary">{success}</div> : null}
      <div className="admin-package-grid fixed-package-admin-grid">
        {packages.map((item) => <article className="admin-package-card fixed-package-admin-card" key={item.code}>
          <div className="admin-package-card-heading"><div><span className="package-level-badge">{item.code.replaceAll("_", " ")}</span><h2>{item.name}</h2></div></div>
          <p>{item.shortDescription}</p>
          <dl className="fixed-package-rules">
            <div><dt>MOQ</dt><dd>{item.perDayMoq} cups / service day</dd></div>
            <div><dt>Pricing</dt><dd>Managed by quotation pricing engine</dd></div>
          </dl>
          <section className="fixed-package-list"><h3>Included</h3><ul>{item.includedItems.map((label) => <li key={label}>✓ {label}</li>)}</ul></section>
          {item.availableCartStyles.length ? <section className="fixed-package-list"><h3>Cart choices</h3><ul>{item.availableCartStyles.map((option) => <li key={option.code}>{option.label}</li>)}</ul></section> : null}
          {item.availableOptions.length ? <section className="fixed-package-list"><h3>Optional</h3><ul>{item.availableOptions.map((option) => <li key={option.code}>{option.label}</li>)}</ul></section> : null}
          <div className="admin-actions"><button type="button" onClick={() => openEditor(item)}>Edit Display Details</button></div>
        </article>)}
      </div>
    </Card>

    {editing ? <div className="modal-backdrop" role="presentation"><div className="drink-modal package-editor-modal" role="dialog" aria-modal="true" aria-labelledby="package-editor-title">
      <div className="package-editor-heading"><div><p className="admin-eyebrow">Presentation Only</p><h2 id="package-editor-title">Edit {editing.name}</h2></div><button className="modal-close" type="button" aria-label="Close" onClick={() => setEditing(null)}>×</button></div>
      <label className="admin-field"><span>Display title</span><input maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className="admin-field"><span>Short description</span><textarea maxLength={300} rows={4} value={draft.shortDescription} onChange={(event) => setDraft({ ...draft, shortDescription: event.target.value })} /></label>
      <div className="fixed-pricing-notice"><strong>Financial rules are locked</strong><span>MOQ, cup tiers, travel, labor, sleeve formulas and option pricing cannot be changed here.</span></div>
      {error ? <p className="error">{error}</p> : null}
      <div className="modal-actions"><button className="hc-button hc-button-secondary" type="button" onClick={() => setEditing(null)} disabled={busy}>Cancel</button><button className="hc-button hc-button-primary" type="button" onClick={() => void save()} disabled={busy}>{busy ? "Saving..." : "Save Display Details"}</button></div>
    </div></div> : null}
  </main>;
}
