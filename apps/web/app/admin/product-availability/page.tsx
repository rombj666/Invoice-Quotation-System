"use client";

import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { createBeverage, deleteBeverage, loadAdminBeverages, removeBeverageImage, updateBeverage, type Beverage } from "../../../lib/beverages";
import { loadProductAvailability, updateProductAvailability, type AvailabilityItem } from "../../../lib/product-availability";

const emptyDraft: Partial<Beverage> = { name: "", description: "", icedAvailable: true, hotAvailable: true, isAvailable: true, isArchived: false, displayOrder: 0 };

export default function ProductAvailabilityPage() {
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [addOns, setAddOns] = useState<AvailabilityItem[]>([]);
  const [editing, setEditing] = useState<Beverage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Beverage>>(emptyDraft);
  const [image, setImage] = useState<File>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyAddon, setBusyAddon] = useState("");

  function refresh() {
    return Promise.all([loadAdminBeverages(), loadProductAvailability()])
      .then(([loadedBeverages, groups]) => { setBeverages(loadedBeverages); setAddOns(groups["Add-on Features"] ?? []); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load product availability."));
  }
  useEffect(() => { void refresh(); }, []);

  function edit(beverage?: Beverage) {
    setModalOpen(true); setEditing(beverage ?? null);
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

  async function toggleBeverage(beverage: Beverage, update: Partial<Beverage>) {
    setError(""); setSuccess("");
    try { const saved = await updateBeverage(beverage.id, update); setBeverages((current) => current.map((item) => item.id === saved.id ? saved : item)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update beverage."); }
  }

  async function remove(beverage: Beverage) {
    if (!window.confirm(`Delete ${beverage.name}? Referenced beverages will be archived instead.`)) return;
    setError(""); setSuccess("");
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

  async function toggleAddon(item: AvailabilityItem) {
    setBusyAddon(item.itemKey); setError(""); setSuccess("");
    try {
      const saved = await updateProductAvailability(item.itemKey, { isAvailable: !item.isAvailable });
      setAddOns((current) => current.map((addOn) => addOn.itemKey === saved.itemKey ? saved : addOn));
      setSuccess(`${saved.itemName} is now ${saved.isAvailable ? "available" : "unavailable"}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update add-on availability."); }
    finally { setBusyAddon(""); }
  }

  function addOnName(item: AvailabilityItem) {
    if (item.itemKey === "coffee_cart") return "Coffee Cart";
    if (item.itemKey === "custom_branded_cart") return "Custom Branded Cart";
    return item.itemName;
  }

  return <main className="admin-page"><Card className="admin-card">
    <header className="admin-page-header"><div><p className="admin-eyebrow">Catalog</p><h1>Product Availability</h1><p>Manage beverages, product images, serving formats and add-on availability.</p></div><button className="hc-button hc-button-primary" type="button" onClick={() => edit()}>Add Beverage</button></header>
    {error ? <p className="error">{error}</p> : null}{success ? <div className="ok-summary">{success}</div> : null}
    <div className="beverage-admin-grid">{beverages.map((beverage) => <article className={`beverage-admin-card ${beverage.isArchived ? "archived" : ""}`} key={beverage.id}>
      {beverage.imageUrl ? <img src={beverage.imageUrl} alt={beverage.name} /> : <div className="beverage-image-placeholder">No image</div>}
      <div className="beverage-admin-content"><h2>{beverage.name}</h2><p>{beverage.description || "No description"}</p><p>Iced: {beverage.icedAvailable ? "Yes" : "No"} · Hot: {beverage.hotAvailable ? "Yes" : "No"}</p><p>Display order: {beverage.displayOrder}</p><span className={`availability-status ${beverage.isArchived ? "archived" : beverage.isAvailable ? "available" : "unavailable"}`}>{beverage.isArchived ? "ARCHIVED" : beverage.isAvailable ? "AVAILABLE" : "UNAVAILABLE"}</span></div>
      <div className="admin-actions beverage-admin-actions"><button type="button" onClick={() => edit(beverage)}>Edit</button>{!beverage.isArchived ? <button type="button" onClick={() => void toggleBeverage(beverage, { isAvailable: !beverage.isAvailable })}>{beverage.isAvailable ? "Mark Unavailable" : "Mark Available"}</button> : null}<button type="button" onClick={() => void toggleBeverage(beverage, { isArchived: !beverage.isArchived, ...(!beverage.isArchived ? { isAvailable: false } : {}) })}>{beverage.isArchived ? "Restore / Unarchive" : "Archive"}</button>{beverage.imageUrl ? <button type="button" onClick={() => void removeImage(beverage)}>Remove Image</button> : null}<button type="button" onClick={() => void remove(beverage)}>Delete</button></div>
    </article>)}</div>

    <section className="addon-availability-section" aria-labelledby="addon-features-heading"><h2 id="addon-features-heading">Add-on Features</h2>
      <div className="admin-table-wrap"><table className="admin-table addon-availability-table"><thead><tr><th>Item</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {addOns.map((item) => <tr key={item.itemKey}><td data-label="Item">{addOnName(item)}</td><td data-label="Status"><span className={`availability-status ${item.isAvailable ? "available" : "unavailable"}`}>{item.isAvailable ? "AVAILABLE" : "UNAVAILABLE"}</span></td><td data-label="Action"><button type="button" disabled={busyAddon === item.itemKey} onClick={() => void toggleAddon(item)}>{busyAddon === item.itemKey ? "Saving…" : item.isAvailable ? "Mark Unavailable" : "Mark Available"}</button></td></tr>)}
        {!addOns.length ? <tr><td colSpan={3}>No add-on features are configured.</td></tr> : null}
      </tbody></table></div>
    </section>

    {modalOpen ? <div className="modal-backdrop"><div className="drink-modal" role="dialog" aria-modal="true"><h2>{editing ? `Edit ${editing.name}` : "Add Beverage"}</h2>
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
