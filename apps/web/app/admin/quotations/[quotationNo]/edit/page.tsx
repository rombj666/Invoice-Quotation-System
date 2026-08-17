"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "../../../../../components/common/Card";
import { QuotationReviewStep } from "../../../../../components/quotation/QuotationReviewStep";
import { prepareAdminQuotationEdit, updateAdminQuotation } from "../../../../../lib/admin-api";
import { generatePdfBlob } from "../../../../../lib/pdf-document";
import { loadQuotationByNo } from "../../../../../lib/quotation-storage";
import type { QuotationData, ServiceDate } from "../../../../../types/quotation";

const addons = ["Coffee Cart", "Custom Branded Cart", "Custom Menu", "Custom Latte Art Stencil"];

export default function AdminQuotationEditPage() {
  const params = useParams<{ quotationNo: string }>();
  const router = useRouter();
  const [data, setData] = useState<QuotationData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadQuotationByNo(params.quotationNo).then((quotation) => quotation && setData({ ...quotation, status: quotation.status ?? "PENDING_APPROVAL" })).catch(() => setError("Unable to load quotation.")); }, [params.quotationNo]);
  if (!data) return <main className="admin-page"><Card className="admin-card"><h1>Edit Quotation</h1><p>{error || "Loading..."}</p></Card></main>;
  const drinks = Object.values(data.beverageSnapshots ?? {}).map((drink) => ({ id: drink.id, label: drink.name }));

  const patch = (value: Partial<QuotationData>) => setData((current) => current ? { ...current, ...value } : current);
  const updateCustomer = (key: keyof QuotationData["customer"], value: string) => patch({ customer: { ...data.customer, [key]: value } });
  const updateDate = (id: string, value: Partial<ServiceDate>) => patch({ serviceDates: data.serviceDates.map((date) => date.id === id ? { ...date, ...value } : date) });
  const toggleDrinkExclusion = (dateId: string, drinkId: string, checked: boolean) => {
    const excluded = data.excludedBeverageIdsByDate?.[dateId] ?? [];
    patch({
      excludedBeverageIdsByDate: { ...(data.excludedBeverageIdsByDate ?? {}), [dateId]: checked ? [...new Set([...excluded, drinkId])] : excluded.filter((id) => id !== drinkId) },
      drinkDistributionModeByDate: { ...(data.drinkDistributionModeByDate ?? {}), [dateId]: "HOUR_COFFEE_DECIDES" },
      drinkOrders: { ...data.drinkOrders, [dateId]: { ...data.drinkOrders[dateId], [drinkId]: { ice: 0, hot: 0 } } },
      letHourCoffeeDecideDrinks: true
    });
  };
  const toggleAddon = (name: string) => {
    const existing = data.selectedAddons.find((addon) => addon.name === name);
    patch({ selectedAddons: existing ? data.selectedAddons.filter((addon) => addon.name !== name) : [...data.selectedAddons, { name, price: 0 }] });
  };
  const addDate = () => {
    const id = crypto.randomUUID();
    patch({ serviceDates: [...data.serviceDates, { id, serviceDate: "", cups: 50, startTime: "09:00", endTime: "11:00" }], drinkOrders: { ...data.drinkOrders, [id]: Object.fromEntries(drinks.map((drink) => [drink.id, { ice: 0, hot: 0 }])) as QuotationData["drinkOrders"][string] }, drinkDistributionModeByDate: { ...(data.drinkDistributionModeByDate ?? {}), [id]: "HOUR_COFFEE_DECIDES" }, excludedBeverageIdsByDate: { ...(data.excludedBeverageIdsByDate ?? {}), [id]: [] }, letHourCoffeeDecideDrinks: true });
  };

  async function save() {
    const currentData = data;
    if (!currentData) return;
    if (!window.confirm("Save these quotation changes and replace the current quotation PDF?")) return;
    setSaving(true); setError(""); setSuccess("");
    try {
      const prepared = await prepareAdminQuotationEdit(params.quotationNo, currentData);
      setData(prepared);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const pdf = await generatePdfBlob("quotationPreview", { filename: `Hour-Coffee-Quotation-${prepared.quotationNo}.pdf` });
      const updated = await updateAdminQuotation(params.quotationNo, prepared, pdf);
      setData(updated); setSuccess("Quotation updated and PDF replaced successfully.");
      if (updated.quotationNo !== params.quotationNo) router.replace(`/admin/quotations/${updated.quotationNo}/edit`);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to update quotation."); }
    finally { setSaving(false); }
  }

  return <main className="admin-page"><Card className="admin-card admin-edit-card">
    <div className="admin-page-header"><div><p className="admin-eyebrow">Quotation</p><h1>Edit {params.quotationNo}</h1><p>Prices and totals are recalculated by the backend when saved.</p></div><Link className="admin-link-button" href={`/admin/quotations/${params.quotationNo}`}>Cancel</Link></div>
    {data.hasInvoice ? <div className="warn-summary">This quotation has a related invoice. Editing it will not modify the existing invoice or its pricing.</div> : null}
    {error ? <p className="error">{error}</p> : null}{success ? <div className="ok-summary">{success}</div> : null}
    <div className="admin-form-grid">
      <section><h2>Reference & Status</h2><label className="admin-field"><span>Quotation number</span><input value={data.quotationNo} onChange={(event)=>patch({quotationNo:event.target.value.toUpperCase()})} /></label><label className="admin-field"><span>Quotation status</span><select value={data.status} onChange={(event)=>patch({status:event.target.value as QuotationData["status"]})}>{["DRAFT","PENDING_APPROVAL","APPROVED","REVIEWED","SENT","CONVERTED_TO_INVOICE","CANCELLED"].map(value=><option key={value}>{value}</option>)}</select></label><label className="admin-field"><span>Discount percent</span><input type="number" min="0" max="100" step="0.01" value={data.discountPercent} onChange={(event)=>patch({discountPercent:Number(event.target.value)})} /></label></section>
      <section><h2>Customer & Billing</h2>{([['name','Name'],['phone','Phone'],['email','Email'],['companyName','Company'],['companyRegNo','Company registration'],['billingAddress','Billing address']] as const).map(([key,label])=><label className="admin-field" key={key}><span>{label}</span><input value={data.customer[key]} onChange={(event)=>updateCustomer(key,event.target.value)} /></label>)}</section>
      <section><h2>Event</h2><label className="admin-field"><span>Location</span><input value={data.location} onChange={(event)=>patch({location:event.target.value})} /></label><label className="admin-field"><span>Full address</span><textarea rows={3} value={data.fullAddress} onChange={(event)=>patch({fullAddress:event.target.value})} /></label><label className="admin-field"><span>Event type</span><input value={data.eventType} onChange={(event)=>patch({eventType:event.target.value})} /></label><label className="admin-field"><span>Custom event type</span><input value={data.customEventType} onChange={(event)=>patch({customEventType:event.target.value})} /></label></section>
    </div>
    <section className="admin-edit-section"><div className="admin-section-heading"><h2>Service Dates & Drink Preferences</h2><button type="button" onClick={addDate}>Add Date</button></div>{data.serviceDates.map((date)=><div className="admin-date-editor" key={date.id}><div className="admin-inline-fields"><label className="admin-field"><span>Date</span><input type="date" value={date.serviceDate} onChange={(event)=>updateDate(date.id,{serviceDate:event.target.value})} /></label><label className="admin-field"><span>Cups</span><input type="number" min="50" step="1" value={date.cups} onChange={(event)=>updateDate(date.id,{cups:Number(event.target.value)})} /></label><label className="admin-field"><span>Start</span><input type="time" value={date.startTime} onChange={(event)=>updateDate(date.id,{startTime:event.target.value})} /></label><label className="admin-field"><span>End</span><input type="time" value={date.endTime} onChange={(event)=>updateDate(date.id,{endTime:event.target.value})} /></label><button type="button" onClick={()=>patch({serviceDates:data.serviceDates.filter(item=>item.id!==date.id)})}>Remove</button></div><div className="admin-drink-editor">{drinks.map((drink)=><div key={drink.id}><strong>{drink.label}</strong><label><input type="checkbox" checked={data.excludedBeverageIdsByDate?.[date.id]?.includes(drink.id) ?? false} onChange={(event)=>toggleDrinkExclusion(date.id,drink.id,event.target.checked)} /> Do not include</label></div>)}</div></div>)}</section>
    <section className="admin-edit-section"><h2>Add-ons</h2><div className="admin-checkbox-grid">{addons.map((name)=><label key={name}><input type="checkbox" checked={data.selectedAddons.some((addon)=>addon.name===name)} onChange={()=>toggleAddon(name)} /> {name}</label>)}<label><input type="checkbox" checked={data.hasCupStickers} onChange={(event)=>patch({hasCupStickers:event.target.checked})} /> Custom Cup Stickers</label><label><input type="checkbox" checked={data.hasCupSleeves} onChange={(event)=>patch({hasCupSleeves:event.target.checked})} /> Custom Cup Sleeves</label></div><div className="admin-inline-fields">{([['cart','Cart'],['sticker','Sticker'],['sleeve','Sleeve']] as const).map(([key,label])=><label className="admin-field" key={key}><span>{label} design count</span><input type="number" min="1" step="1" value={data.customizationOptions[key].designCount} onChange={(event)=>patch({customizationOptions:{...data.customizationOptions,[key]:{...data.customizationOptions[key],designCount:Number(event.target.value)}}})} /></label>)}</div></section>
    <div className="print-document" aria-hidden="true"><QuotationReviewStep data={data} readOnly /></div>
    <div className="admin-edit-actions"><button className="hc-button hc-button-primary" type="button" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save Changes"}</button><Link className="hc-button hc-button-secondary" href={`/admin/quotations/${params.quotationNo}`}>Cancel</Link></div>
  </Card></main>;
}
