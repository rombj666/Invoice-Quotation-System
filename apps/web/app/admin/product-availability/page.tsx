"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { createBeverage, deleteBeverage, loadAdminBeverages, removeBeverageImage, updateBeverage, type Beverage } from "../../../lib/beverages";

const emptyDraft: Partial<Beverage> = { name: "", description: "", icedAvailable: true, hotAvailable: true, isAvailable: true, isArchived: false, displayOrder: 0 };

export default function BeverageManagementPage() {
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [editing, setEditing] = useState<Beverage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Beverage>>(emptyDraft);
  const [image, setImage] = useState<File>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => loadAdminBeverages().then(setBeverages).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load beverages."));
  useEffect(() => { void refresh(); }, []);

  function edit(beverage?: Beverage) {
    setModalOpen(true);
    setEditing(beverage ?? null);
    setDraft(beverage ? { ...beverage } : { ...emptyDraft, displayOrder: (beverages.at(-1)?.displayOrder ?? 0) + 10 });
    setImage(undefined); setError(""); setSuccess("");
  }

  async function save() {
    setBusy(true); setError(""); setSuccess("");
    try {
      const saved = editing ? await updateBeverage(editing.id, draft, image) : await createBeverage(draft, image);
      setBeverages((current) => [...current.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)));
      setModalOpen(false); setEditing(null); setDraft(emptyDraft); setImage(undefined); setSuccess("Beverage saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save beverage."); }
    finally { setBusy(false); }
  }

  async function toggle(beverage: Beverage, update: Partial<Beverage>) {
    setError("");
    try { const saved = await updateBeverage(beverage.id, update); setBeverages((current) => current.map((item) => item.id === saved.id ? saved : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update beverage."); }
  }

  async function remove(beverage: Beverage) {
    if (!window.confirm(`Delete ${beverage.name}? Referenced beverages will be archived instead.`)) return;
    setError("");
    try { await deleteBeverage(beverage.id); setBeverages((current) => current.filter((item) => item.id !== beverage.id)); setSuccess("Beverage deleted."); }
    catch (reason) {
      const archived = (reason as Error & { beverage?: Beverage }).beverage;
      if (archived) setBeverages((current) => current.map((item) => item.id === archived.id ? archived : item));
      setError(reason instanceof Error ? reason.message : "Unable to delete beverage.");
    }
  }

  async function removeImage(beverage: Beverage) {
    if (!window.confirm(`Remove the image for ${beverage.name}?`)) return;
    try { const saved = await removeBeverageImage(beverage.id); setBeverages((current) => current.map((item) => item.id === saved.id ? saved : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to remove image."); }
  }

  return <main className="admin-page"><Card className="admin-card">
    <header className="admin-page-header"><div><p className="admin-eyebrow">Catalog</p><h1>Beverage Management</h1><p>Manage availability, serving formats, images, archives, and display order.</p></div><button className="hc-button hc-button-primary" type="button" onClick={() => edit()}>Add beverage</button></header>
    {error ? <p className="error">{error}</p> : null}{success ? <div className="ok-summary">{success}</div> : null}
    <div className="beverage-admin-grid">{beverages.map((beverage) => <article className={`beverage-admin-card ${beverage.isArchived ? "archived" : ""}`} key={beverage.id}>
      {beverage.imageUrl ? <img src={beverage.imageUrl} alt={beverage.name} /> : <div className="beverage-image-placeholder">No image</div>}
      <div><h2>{beverage.name}</h2><p>{beverage.description || "No description"}</p><p>Iced: {beverage.icedAvailable ? "Yes" : "No"} · Hot: {beverage.hotAvailable ? "Yes" : "No"}</p><p>Order: {beverage.displayOrder}</p><strong>{beverage.isArchived ? "Archived" : beverage.isAvailable ? "Available" : "Unavailable"}</strong></div>
      <div className="admin-actions"><button type="button" onClick={() => edit(beverage)}>Edit</button><button type="button" onClick={() => void toggle(beverage, { isAvailable: !beverage.isAvailable })}>{beverage.isAvailable ? "Mark unavailable" : "Mark available"}</button><button type="button" onClick={() => void toggle(beverage, { isArchived: !beverage.isArchived, ...(!beverage.isArchived ? { isAvailable: false } : {}) })}>{beverage.isArchived ? "Unarchive" : "Archive"}</button>{beverage.imageUrl ? <button type="button" onClick={() => void removeImage(beverage)}>Remove image</button> : null}<button type="button" onClick={() => void remove(beverage)}>Delete</button></div>
    </article>)}</div>
    {modalOpen ? <div className="modal-backdrop"><div className="drink-modal" role="dialog" aria-modal="true"><h2>{editing ? `Edit ${editing.name}` : "Add beverage"}</h2>
      <label className="admin-field"><span>Name</span><input value={draft.name ?? ""} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
      <label className="admin-field"><span>Description</span><textarea rows={3} value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      <label className="admin-field"><span>Display order</span><input type="number" min="0" step="1" value={draft.displayOrder ?? 0} onChange={(event) => setDraft({ ...draft, displayOrder: Number(event.target.value) })} /></label>
      <label><input type="checkbox" checked={draft.icedAvailable ?? true} onChange={(event) => setDraft({ ...draft, icedAvailable: event.target.checked })} /> Iced available</label>
      <label><input type="checkbox" checked={draft.hotAvailable ?? true} onChange={(event) => setDraft({ ...draft, hotAvailable: event.target.checked })} /> Hot available</label>
      <label><input type="checkbox" checked={draft.isAvailable ?? true} onChange={(event) => setDraft({ ...draft, isAvailable: event.target.checked })} /> Available for new quotations</label>
      <label className="admin-field"><span>{editing?.imageUrl ? "Replace image" : "Upload image"}</span><input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0])} /></label>
      <div className="modal-actions"><button className="hc-button hc-button-secondary" type="button" onClick={() => { setModalOpen(false); setEditing(null); setDraft(emptyDraft); }}>Cancel</button><button className="hc-button hc-button-primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Saving..." : "Save"}</button></div>
    </div></div> : null}
  </Card></main>;
}
