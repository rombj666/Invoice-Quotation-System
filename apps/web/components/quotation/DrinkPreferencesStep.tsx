"use client";

import { useEffect, useMemo, useState } from "react";
import { loadBeverages, type Beverage } from "../../lib/beverages";
import { formatShortDate } from "../../lib/formatters";
import type { DrinkDistributionModeByDate, QuotationData } from "../../types/quotation";
import { StepNavigation } from "../common/StepNavigation";

type Props = { data: QuotationData; setData: (data: QuotationData) => void; onBack: () => void; onNext: () => void; error: string };
const legacyIds: Record<string, string> = { americano: "bev_americano", latte: "bev_cafe_latte", chocolate: "bev_dark_chocolate", lemonade: "bev_lemonade" };

export function DrinkPreferencesStep({ data, setData, onBack, onNext, error }: Props) {
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [activeDateId, setActiveDateId] = useState(data.serviceDates[0]?.id ?? "");
  const [loadError, setLoadError] = useState("");
  const activeDate = useMemo(() => data.serviceDates.find((date) => date.id === activeDateId) ?? data.serviceDates[0], [activeDateId, data.serviceDates]);
  const mode = activeDate ? data.drinkDistributionModeByDate?.[activeDate.id] ?? (data.letHourCoffeeDecideDrinks ? "HOUR_COFFEE_DECIDES" : "MANUAL") : "MANUAL";
  const excluded = activeDate ? data.excludedBeverageIdsByDate?.[activeDate.id] ?? [] : [];

  useEffect(() => {
    loadBeverages().then((loaded) => {
      setBeverages(loaded);
      const snapshots = { ...(data.beverageSnapshots ?? {}) };
      loaded.forEach((item) => { snapshots[item.id] = { id: item.id, name: item.name, imageUrl: item.imageUrl, icedAvailable: item.icedAvailable, hotAvailable: item.hotAvailable }; });
      const orders = { ...data.drinkOrders };
      for (const date of data.serviceDates) {
        const current = { ...(orders[date.id] ?? {}) };
        for (const [oldId, newId] of Object.entries(legacyIds)) if (current[oldId] && !current[newId]) { current[newId] = current[oldId]; delete current[oldId]; }
        loaded.forEach((item) => { current[item.id] ??= { ice: 0, hot: 0 }; });
        orders[date.id] = current;
      }
      setData({ ...data, drinkOrders: orders, beverageSnapshots: snapshots });
    }).catch(() => setLoadError("Unable to load the beverage catalog."));
    // Catalog initialization is intentionally performed once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!activeDate) return null;
  const order = data.drinkOrders[activeDate.id] ?? {};
  const assigned = Object.entries(order).reduce((sum, [id, value]) => excluded.includes(id) ? sum : sum + value.ice + value.hot, 0);
  const remaining = activeDate.cups - assigned;
  const allExcluded = beverages.length > 0 && beverages.every((item) => excluded.includes(item.id));
  const valid = beverages.length > 0 && !allExcluded && (mode === "HOUR_COFFEE_DECIDES" || assigned === activeDate.cups);

  function updateQuantity(beverage: Beverage, kind: "ice" | "hot", value: number) {
    if (mode !== "MANUAL" || excluded.includes(beverage.id)) return;
    const safe = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
    const current = order[beverage.id] ?? { ice: 0, hot: 0 };
    setData({ ...data, drinkOrders: { ...data.drinkOrders, [activeDate.id]: { ...order, [beverage.id]: { ...current, [kind]: safe } } } });
  }

  function setMode(decides: boolean) {
    const nextMode = decides ? "HOUR_COFFEE_DECIDES" : "MANUAL";
    const nextOrder = decides ? Object.fromEntries(Object.keys(order).map((id) => [id, { ice: 0, hot: 0 }])) : order;
    const modes: DrinkDistributionModeByDate = { ...(data.drinkDistributionModeByDate ?? {}), [activeDate.id]: nextMode };
    setData({ ...data, drinkOrders: { ...data.drinkOrders, [activeDate.id]: nextOrder }, drinkDistributionModeByDate: modes, letHourCoffeeDecideDrinks: data.serviceDates.every((date) => (date.id === activeDate.id ? nextMode : modes[date.id]) === "HOUR_COFFEE_DECIDES") });
  }

  function toggleExcluded(beverage: Beverage, checked: boolean) {
    const nextExcluded = checked ? [...new Set([...excluded, beverage.id])] : excluded.filter((id) => id !== beverage.id);
    const nextOrder = checked ? { ...order, [beverage.id]: { ice: 0, hot: 0 } } : order;
    setData({ ...data, drinkOrders: { ...data.drinkOrders, [activeDate.id]: nextOrder }, excludedBeverageIdsByDate: { ...(data.excludedBeverageIdsByDate ?? {}), [activeDate.id]: nextExcluded } });
  }

  return <div>
    <h2>Drink preferences</h2><p className="step-copy">Choose a distribution mode and preferences for each service date.</p>
    {data.serviceDates.length > 1 ? <div className="tab-row">{data.serviceDates.map((date) => <button className={date.id === activeDate.id ? "active" : ""} type="button" key={date.id} onClick={() => setActiveDateId(date.id)}>{formatShortDate(date.serviceDate)}</button>)}</div> : null}
    <label className="same-distribution-option decision-option"><input type="checkbox" checked={mode === "HOUR_COFFEE_DECIDES"} onChange={(event) => setMode(event.target.checked)} /><span>Let Hour Coffee decide the drink distribution for this event.</span></label>
    <div className="beverage-card-grid">{beverages.map((beverage) => {
      const quantity = order[beverage.id] ?? { ice: 0, hot: 0 };
      const isExcluded = excluded.includes(beverage.id);
      const control = (kind: "ice" | "hot", label: string) => <div className="beverage-quantity"><span>{label}</span><div className="stepper-row"><button type="button" disabled={mode !== "MANUAL" || isExcluded} onClick={() => updateQuantity(beverage, kind, quantity[kind] - 1)}>−</button><input aria-label={`${beverage.name} ${label}`} type="number" min="0" step="1" disabled={mode !== "MANUAL" || isExcluded} value={quantity[kind]} onChange={(event) => updateQuantity(beverage, kind, Number(event.target.value))} /><button type="button" disabled={mode !== "MANUAL" || isExcluded} onClick={() => updateQuantity(beverage, kind, quantity[kind] + 1)}>+</button></div></div>;
      return <article className={`beverage-choice-card ${isExcluded ? "excluded" : ""}`} key={beverage.id}>
        {beverage.imageUrl ? <img src={beverage.imageUrl} alt={beverage.name} /> : <div className="beverage-image-placeholder">{beverage.name}</div>}
        <h3>{beverage.name}</h3>{beverage.description ? <p>{beverage.description}</p> : null}
        {beverage.icedAvailable ? control("ice", "Iced") : null}
        {beverage.hotAvailable ? control("hot", "Hot") : <p className="muted-text">Hot not available</p>}
        <label className="exclude-drink"><input type="checkbox" checked={isExcluded} onChange={(event) => toggleExcluded(beverage, event.target.checked)} /> Do not include this drink</label>
      </article>;
    })}</div>
    {mode === "HOUR_COFFEE_DECIDES" ? <div className="ok-summary">Hour Coffee will decide the drink distribution for this event.{excluded.length ? <><br />Do not include: {excluded.map((id) => data.beverageSnapshots?.[id]?.name ?? id).join(", ")}</> : null}</div> : <div className={assigned === activeDate.cups ? "ok-summary" : "warn-summary"}>Assigned cups: {assigned} of {activeDate.cups}<br />{remaining >= 0 ? `Remaining cups: ${remaining}` : `Assigned cups exceed the service-date cup total by ${Math.abs(remaining)}.`}</div>}
    {allExcluded ? <p className="error">At least one available beverage must remain allowed.</p> : null}{loadError ? <p className="error">{loadError}</p> : null}{error ? <p className="error">{error}</p> : null}
    <StepNavigation onBack={onBack} onNext={onNext} nextDisabled={!valid} />
  </div>;
}
