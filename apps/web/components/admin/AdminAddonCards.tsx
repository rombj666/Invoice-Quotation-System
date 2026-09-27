"use client";

import { useEffect, useState } from "react";
import type { QuotationData } from "../../types/quotation";
import { FIXED_ADDON_DEFAULTS, getConfiguredAddonPricing, getConfiguredFixedPrice } from "../../lib/addons";
import { addonAvailabilityKeys, flattenAvailability, loadProductAvailability, type AvailabilityItem } from "../../lib/product-availability";
import { getCupSleevePrice, getCupStickerPrice } from "../../lib/invoice-pricing";
import { formatMoney } from "../../lib/formatters";

const designKinds: Record<string, "cart" | "sticker" | "sleeve"> = {
  "Custom Branded Cart": "cart", "Custom Cup Stickers": "sticker", "Custom Cup Sleeves": "sleeve"
};

export function AdminAddonCards({ data, onChange }: { data: QuotationData; onChange: (value: Partial<QuotationData>) => void }) {
  const [catalog, setCatalog] = useState<Record<string, AvailabilityItem>>({});
  useEffect(() => { let active = true; loadProductAvailability().then((items) => { if (active) setCatalog(flattenAvailability(items)); }).catch(() => undefined); return () => { active = false; }; }, []);
  const names = [...new Set([...Object.keys(FIXED_ADDON_DEFAULTS), "Custom Cup Stickers", "Custom Cup Sleeves", ...data.selectedAddons.map((addon) => addon.name)])];
  const cups = data.totalCups ?? data.serviceDates.reduce((total, date) => total + date.cups, 0);
  const rates = Object.keys(catalog).length ? getConfiguredAddonPricing(catalog) : data.addonPricing;
  return <section><h2>Add-ons</h2><div className="admin-addon-cards">{names.map((name) => {
    const saved = data.selectedAddons.find((addon) => addon.name === name);
    const selected = name === "Custom Cup Sleeves" ? data.hasCupSleeves : name === "Custom Cup Stickers" ? data.hasCupStickers : Boolean(saved);
    const price = name === "Custom Cup Sleeves" ? getCupSleevePrice(cups, rates?.cupSleeve) : name === "Custom Cup Stickers" ? getCupStickerPrice(cups, rates?.cupSticker) : getConfiguredFixedPrice(catalog[addonAvailabilityKeys[name]], saved?.price ?? FIXED_ADDON_DEFAULTS[name as keyof typeof FIXED_ADDON_DEFAULTS] ?? 0);
    const kind = designKinds[name];
    const count = kind ? data.customizationOptions?.[kind]?.designCount ?? 1 : 1;
    const setCount = (value: number) => kind && onChange({ customizationOptions: { ...data.customizationOptions, [kind]: { ...data.customizationOptions[kind], designCount: Math.max(1, value) } } });
    function toggle() {
      if (name === "Custom Cup Sleeves") return onChange({ hasCupSleeves: !selected });
      if (name === "Custom Cup Stickers") return onChange({ hasCupStickers: !selected });
      onChange({ selectedAddons: selected ? data.selectedAddons.filter((addon) => addon.name !== name) : [...data.selectedAddons, { name, price }] });
    }
    return <article className={`admin-addon-card ${selected ? "selected" : ""}`} key={name}>
      <h3>{name}</h3><p className="admin-addon-price">{formatMoney(price)}</p>
      <button type="button" aria-pressed={selected} aria-label={`${selected ? "Deselect" : "Select"} ${name}`} onClick={toggle}>{selected ? "Selected" : "Select"}</button>
      {selected && kind ? <div className="admin-design-count"><span>Designs</span><button type="button" aria-label={`Fewer ${name} designs`} disabled={count <= 1} onClick={() => setCount(count - 1)}>−</button><output aria-live="polite">{count}</output><button type="button" aria-label={`More ${name} designs`} onClick={() => setCount(count + 1)}>+</button></div> : null}
    </article>;
  })}</div></section>;
}
