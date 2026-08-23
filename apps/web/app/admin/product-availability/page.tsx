"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { formatMoney } from "../../../lib/formatters";
import { createPackage, deletePackage, loadAdminPackages, updatePackage } from "../../../lib/packages";
import type { PackageLevel, QuotationPackage } from "../../../types/quotation";

type PackageDraft = { name: string; level: PackageLevel; briefDescription: string; price: string; perks: string[] };

const levelOptions: Array<{ value: PackageLevel; label: string }> = [
  { value: "LOW_SPEC", label: "Low Spec" },
  { value: "MIDDLE_SPEC", label: "Middle Spec" },
  { value: "HIGH_SPEC", label: "High Spec" },
  { value: "CUSTOMIZED", label: "Customized Package" }
];
const emptyDraft: PackageDraft = { name: "", level: "LOW_SPEC", briefDescription: "", price: "", perks: [""] };

function levelLabel(level: PackageLevel) {
  return levelOptions.find((option) => option.value === level)?.label ?? level;
}

export default function PackageSettingsPage() {
  const [packages, setPackages] = useState<QuotationPackage[]>([]);
  const [expandedId, setExpandedId] = useState("");
  const [editing, setEditing] = useState<QuotationPackage | null>(null);
  const [draft, setDraft] = useState<PackageDraft>(emptyDraft);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    setError("");
    try { setPackages(await loadAdminPackages()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load quotation packages."); }
  }

  useEffect(() => { void refresh(); }, []);

  function openEditor(item?: QuotationPackage) {
    setEditing(item ?? null);
    setDraft(item ? {
      name: item.name,
      level: item.level,
      briefDescription: item.briefDescription ?? "",
      price: String(item.price),
      perks: item.perks.length ? item.perks.map((perk) => perk.name) : [""]
    } : { ...emptyDraft, perks: [""] });
    setError(""); setSuccess(""); setModalOpen(true);
  }

  function updatePerk(index: number, value: string) {
    setDraft((current) => ({ ...current, perks: current.perks.map((perk, perkIndex) => perkIndex === index ? value : perk) }));
  }

  async function save() {
    const price = Number(draft.price);
    if (!draft.name.trim()) return setError("Package name is required.");
    if (!Number.isFinite(price) || price < 0) return setError("Enter a valid package price.");
    setBusy(true); setError("");
    try {
      const input = { ...draft, name: draft.name.trim(), briefDescription: draft.briefDescription.trim(), price, perks: draft.perks.map((perk) => perk.trim()).filter(Boolean) };
      const saved = editing ? await updatePackage(editing.id, input) : await createPackage(input);
      setPackages((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => levelOptions.findIndex((option) => option.value === a.level) - levelOptions.findIndex((option) => option.value === b.level)));
      setModalOpen(false); setEditing(null); setSuccess(editing ? "Package updated." : "Package created.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save package."); }
    finally { setBusy(false); }
  }

  async function remove(item: QuotationPackage) {
    if (!window.confirm(`Delete ${item.name}? Existing quotations will keep their saved package snapshot.`)) return;
    setError(""); setSuccess("");
    try { await deletePackage(item.id); setPackages((current) => current.filter((candidate) => candidate.id !== item.id)); setSuccess("Package deleted."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete package."); }
  }

  return <main className="admin-page">
    <Card className="admin-card package-settings-admin">
      <header className="admin-page-header"><div><p className="admin-eyebrow">Quotation Setup</p><h1>Package Settings</h1><p>Manage the four package choices, fixed prices and included perks shown to customers.</p></div><button className="hc-button hc-button-primary" type="button" onClick={() => openEditor()}>Create Package</button></header>
      {error && !modalOpen ? <p className="error">{error}</p> : null}{success ? <div className="ok-summary">{success}</div> : null}
      <div className="admin-package-grid">
        {packages.map((item) => {
          const expanded = expandedId === item.id;
          return <article className="admin-package-card" key={item.id}>
            <div className="admin-package-card-heading"><div><span className={`package-level-badge ${item.level.toLowerCase()}`}>{levelLabel(item.level)}</span><h2>{item.name}</h2></div><strong>{formatMoney(item.price)}</strong></div>
            <p>{item.briefDescription || "No package description."}</p>
            <div className="admin-package-preview"><strong>{item.perks.length} included perk{item.perks.length === 1 ? "" : "s"}</strong><span>{item.perks.slice(0, 2).map((perk) => perk.name).join(" · ") || "No perks added yet"}</span></div>
            {expanded ? <ul className="admin-package-perks">{item.perks.map((perk) => <li key={perk.id}>{perk.name}</li>)}{!item.perks.length ? <li>No included perks.</li> : null}</ul> : null}
            <div className="admin-actions"><button type="button" onClick={() => setExpandedId(expanded ? "" : item.id)}>{expanded ? "Hide" : "View"}</button><button type="button" onClick={() => openEditor(item)}>Edit</button><button type="button" onClick={() => void remove(item)}>Delete</button></div>
          </article>;
        })}
        {!packages.length && !error ? <div className="admin-package-empty"><h2>No packages yet</h2><p>Create a package to make it available in the customer quotation flow.</p></div> : null}
      </div>
    </Card>

    {modalOpen ? <div className="modal-backdrop" role="presentation"><div className="drink-modal package-editor-modal" role="dialog" aria-modal="true" aria-labelledby="package-editor-title">
      <div className="package-editor-heading"><div><p className="admin-eyebrow">Package Details</p><h2 id="package-editor-title">{editing ? `Edit ${editing.name}` : "Create Package"}</h2></div><button className="modal-close" type="button" aria-label="Close" onClick={() => setModalOpen(false)}>×</button></div>
      <div className="admin-inline-fields"><label className="admin-field"><span>Package name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label className="admin-field"><span>Level / type</span><select value={draft.level} onChange={(event) => setDraft({ ...draft, level: event.target.value as PackageLevel })}>{levelOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label></div>
      <label className="admin-field"><span>Brief description</span><textarea rows={3} value={draft.briefDescription} onChange={(event) => setDraft({ ...draft, briefDescription: event.target.value })} /></label>
      <label className="admin-field"><span>Package price (RM)</span><input type="number" min="0" step="0.01" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} /></label>
      <section className="package-perk-editor"><div><h3>Included perks</h3><button type="button" onClick={() => setDraft((current) => ({ ...current, perks: [...current.perks, ""] }))}>+ Add Perk</button></div><p>Cup quantity is entered by the customer and is not a package perk.</p>
        {draft.perks.map((perk, index) => <div className="package-perk-row" key={index}><input aria-label={`Perk ${index + 1}`} placeholder="e.g. Branded coffee cart" value={perk} onChange={(event) => updatePerk(index, event.target.value)} /><button type="button" aria-label={`Remove perk ${index + 1}`} onClick={() => setDraft((current) => ({ ...current, perks: current.perks.filter((_, perkIndex) => perkIndex !== index) }))}>Remove</button></div>)}
        {!draft.perks.length ? <p className="package-perks-empty">No perks added. Use “Add Perk” to include one.</p> : null}
      </section>
      {error ? <p className="error">{error}</p> : null}<div className="modal-actions"><button className="hc-button hc-button-secondary" type="button" onClick={() => setModalOpen(false)} disabled={busy}>Cancel</button><button className="hc-button hc-button-primary" type="button" onClick={() => void save()} disabled={busy}>{busy ? "Saving..." : editing ? "Save Changes" : "Create Package"}</button></div>
    </div></div> : null}
  </main>;
}
