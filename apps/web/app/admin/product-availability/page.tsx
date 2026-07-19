"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { formatMoney } from "../../../lib/formatters";
import { loadProductAvailability, updateProductAvailability, type AvailabilityGroups, type AvailabilityItem } from "../../../lib/product-availability";

type PriceDraft = Record<string, string>;

function pricingSummary(item: AvailabilityItem): string[] {
  const config = item.pricingConfig ?? {};
  if (item.pricingType === "FREE") return ["FREE"];
  if (item.pricingType === "FIXED") return [formatMoney(item.price ?? 0)];
  if (item.pricingType === "STICKER_TIERS") {
    return [
      `Up to ${config.baseCupLimit} cups: ${formatMoney(config.basePrice)}`,
      `Each additional ${config.additionalTierCups}-cup tier: ${formatMoney(config.additionalTierPrice)}`
    ];
  }
  if (item.pricingType === "SLEEVE_RATES") {
    return [
      `Below ${config.threshold} cups: ${formatMoney(config.rateBelowThreshold)} per cup`,
      `${config.threshold} cups and above: ${formatMoney(config.rateAtOrAboveThreshold)} per cup`
    ];
  }
  return [];
}

function initialDraft(item: AvailabilityItem): PriceDraft {
  if (item.pricingType === "FIXED") return { price: String(item.price ?? 0) };
  return Object.fromEntries(Object.entries(item.pricingConfig ?? {}).map(([key, value]) => [key, String(value)]));
}

function parseCurrency(value: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isInteger(amount) && amount > 0 ? amount : null;
}

export default function ProductAvailabilityPage() {
  const [groups, setGroups] = useState<AvailabilityGroups>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingKey, setEditingKey] = useState("");
  const [draft, setDraft] = useState<PriceDraft>({});
  const [isSaving, setIsSaving] = useState(false);

  async function refresh() {
    setError("");
    try {
      setGroups(await loadProductAvailability());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load product availability.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function replaceItem(updated: AvailabilityItem) {
    setGroups((current) => ({
      ...current,
      [updated.category]: (current[updated.category] ?? []).map((item) => (item.itemKey === updated.itemKey ? updated : item))
    }));
  }

  async function toggle(itemKey: string, isAvailable: boolean) {
    setError("");
    setSuccess("");
    try {
      replaceItem(await updateProductAvailability(itemKey, { isAvailable: !isAvailable }));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update availability.");
    }
  }

  function beginEdit(item: AvailabilityItem) {
    setError("");
    setSuccess("");
    setEditingKey(item.itemKey);
    setDraft(initialDraft(item));
  }

  async function savePrice(item: AvailabilityItem) {
    setError("");
    setSuccess("");
    let update: { price?: number; pricingConfig?: Record<string, number> } | null = null;

    if (item.pricingType === "FIXED") {
      const price = parseCurrency(draft.price ?? "");
      if (price !== null) update = { price };
    } else if (item.pricingType === "STICKER_TIERS") {
      const baseCupLimit = parsePositiveInteger(draft.baseCupLimit ?? "");
      const basePrice = parseCurrency(draft.basePrice ?? "");
      const additionalTierCups = parsePositiveInteger(draft.additionalTierCups ?? "");
      const additionalTierPrice = parseCurrency(draft.additionalTierPrice ?? "");
      if (baseCupLimit !== null && basePrice !== null && additionalTierCups !== null && additionalTierPrice !== null) {
        update = { pricingConfig: { baseCupLimit, basePrice, additionalTierCups, additionalTierPrice } };
      }
    } else if (item.pricingType === "SLEEVE_RATES") {
      const threshold = parsePositiveInteger(draft.threshold ?? "");
      const rateBelowThreshold = parseCurrency(draft.rateBelowThreshold ?? "");
      const rateAtOrAboveThreshold = parseCurrency(draft.rateAtOrAboveThreshold ?? "");
      if (threshold !== null && rateBelowThreshold !== null && rateAtOrAboveThreshold !== null) {
        update = { pricingConfig: { threshold, rateBelowThreshold, rateAtOrAboveThreshold } };
      }
    }

    if (!update) {
      setError("Enter valid non-negative prices with no more than 2 decimal places. Thresholds must be positive whole numbers.");
      return;
    }

    setIsSaving(true);
    try {
      replaceItem(await updateProductAvailability(item.itemKey, update));
      setEditingKey("");
      setDraft({});
      setSuccess("Add-on price updated successfully.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update add-on price.");
    } finally {
      setIsSaving(false);
    }
  }

  function field(label: string, key: string, integer = false, currency = true) {
    return (
      <label className="availability-price-field" key={key}>
        <span>{label}</span>
        <div>{currency ? <span>RM</span> : <span>Cups</span>}<input type="number" min={integer ? 1 : 0} step={integer ? 1 : 0.01} value={draft[key] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} /></div>
      </label>
    );
  }

  function priceEditor(item: AvailabilityItem) {
    return (
      <div className="availability-price-editor">
        {item.pricingType === "FIXED" ? field("Fixed price", "price") : null}
        {item.pricingType === "STICKER_TIERS" ? (
          <>
            {field("Base cup limit", "baseCupLimit", true, false)}
            {field("Base price", "basePrice")}
            {field("Additional tier size", "additionalTierCups", true, false)}
            {field("Price per additional tier", "additionalTierPrice")}
          </>
        ) : null}
        {item.pricingType === "SLEEVE_RATES" ? (
          <>
            {field("Cup threshold", "threshold", true, false)}
            {field("Rate below threshold", "rateBelowThreshold")}
            {field("Rate at/above threshold", "rateAtOrAboveThreshold")}
          </>
        ) : null}
        <div className="availability-price-actions">
          <button className="availability-action-button edit-price" type="button" disabled={isSaving} onClick={() => savePrice(item)}>{isSaving ? "Saving..." : "Save"}</button>
          <button className="availability-action-button cancel-price" type="button" disabled={isSaving} onClick={() => { setEditingKey(""); setDraft({}); setError(""); }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <main className="hc-page admin-page">
      <Card className="admin-card">
        <div className="admin-nav">
          <Link href="/admin">Admin Home</Link>
          <Link href="/admin/quotations">Quotation List</Link>
          <Link href="/admin/invoices">Invoice List</Link>
          <Link href="/admin/product-availability">Product Availability</Link>
        </div>
        <h1>Product Availability</h1>
        {error ? <p className="error">{error}</p> : null}
        {success ? <div className="ok-summary">{success}</div> : null}
        {["Beverages", "Add-on Features"].map((category) => {
          const isAddonCategory = category === "Add-on Features";
          return (
            <section className="availability-section" key={category}>
              <h2>{category}</h2>
              <div className="admin-table-wrap">
                <table className="admin-table availability-table">
                  <thead><tr><th>Item</th>{isAddonCategory ? <th>Price / Pricing Rule</th> : null}<th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {(groups[category] ?? []).map((item) => (
                      <tr key={item.itemKey}>
                        <td>{item.itemName}</td>
                        {isAddonCategory ? (
                          <td className="availability-price-cell">
                            {editingKey === item.itemKey ? priceEditor(item) : pricingSummary(item).map((line) => <span key={line}>{line}</span>)}
                          </td>
                        ) : null}
                        <td><span className={`admin-status-badge ${item.isAvailable ? "approved" : "deleted"}`}>{item.isAvailable ? "Available" : "Unavailable"}</span></td>
                        <td>
                          <div className="availability-row-actions">
                            {isAddonCategory && item.pricingType !== "FREE" ? (
                              <button className="availability-action-button edit-price" type="button" onClick={() => beginEdit(item)} disabled={Boolean(editingKey)}>
                                Edit Price
                              </button>
                            ) : null}
                            <button className={`availability-action-button ${item.isAvailable ? "mark-unavailable" : "mark-available"}`} type="button" onClick={() => toggle(item.itemKey, item.isAvailable)}>
                              {item.isAvailable ? "Mark Unavailable" : "Mark Available"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </Card>
    </main>
  );
}
