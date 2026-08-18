"use client";

import { useEffect, useMemo, useState } from "react";
import { loadBeverages, type Beverage } from "../../lib/beverages";
import { formatShortDate } from "../../lib/formatters";
import type { QuotationData } from "../../types/quotation";
import { StepNavigation } from "../common/StepNavigation";

type Props = { data: QuotationData; setData: (data: QuotationData) => void; onBack: () => void; onNext: () => void; error: string; embedded?: boolean; onValidityChange?: (valid: boolean) => void };
const legacyIds: Record<string, string> = { americano: "bev_americano", latte: "bev_cafe_latte", chocolate: "bev_dark_chocolate", lemonade: "bev_lemonade" };

export function DrinkPreferencesStep({ data, setData, onBack, onNext, error, embedded = false, onValidityChange }: Props) {
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [activeDateId, setActiveDateId] = useState(data.serviceDates[0]?.id ?? "");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const activeDate = useMemo(() => data.serviceDates.find((date) => date.id === activeDateId) ?? data.serviceDates[0], [activeDateId, data.serviceDates]);
  const excluded = activeDate ? data.excludedBeverageIdsByDate?.[activeDate.id] ?? [] : [];

  useEffect(() => {
    loadBeverages().then((loaded) => {
      setBeverages(loaded);
    }).catch(() => setLoadError("Unable to load the beverage catalog."))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!beverages.length) return;
    const snapshots: NonNullable<QuotationData["beverageSnapshots"]> = {};
    beverages.forEach((item) => { snapshots[item.id] = { id: item.id, name: item.name, imageUrl: item.imageUrl, icedAvailable: item.icedAvailable, hotAvailable: item.hotAvailable }; });
    const orders = { ...data.drinkOrders };
    const exclusions = { ...(data.excludedBeverageIdsByDate ?? {}) };
    const modes = { ...(data.drinkDistributionModeByDate ?? {}) };
    const availableIds = new Set(beverages.map((item) => item.id));
    let changed = JSON.stringify(data.beverageSnapshots ?? {}) !== JSON.stringify(snapshots);
    for (const date of data.serviceDates) {
      if (!orders[date.id]) {
        orders[date.id] = Object.fromEntries(beverages.map((item) => [item.id, { ice: 0, hot: 0 }]));
        changed = true;
      }
      const normalizedExclusions = [...new Set((exclusions[date.id] ?? []).map((id) => legacyIds[id] ?? id))].filter((id) => availableIds.has(id));
      if (JSON.stringify(exclusions[date.id] ?? []) !== JSON.stringify(normalizedExclusions)) changed = true;
      exclusions[date.id] = normalizedExclusions;
      if (modes[date.id] !== "HOUR_COFFEE_DECIDES") changed = true;
      modes[date.id] = "HOUR_COFFEE_DECIDES";
    }
    if (changed) setData({ ...data, drinkOrders: orders, beverageSnapshots: snapshots, drinkDistributionModeByDate: modes, excludedBeverageIdsByDate: exclusions, letHourCoffeeDecideDrinks: true });
    // Keep mappings synchronized when dates are added on the combined event setup step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beverages, data.serviceDates]);

  const hasInvalidDate = data.serviceDates.some((date) => beverages.length > 0 && beverages.every((item) => data.excludedBeverageIdsByDate?.[date.id]?.includes(item.id)));
  const valid = !isLoading && beverages.length > 0 && data.serviceDates.length > 0 && !hasInvalidDate;

  useEffect(() => {
    onValidityChange?.(valid);
  }, [onValidityChange, valid]);

  if (!activeDate) return <div className={embedded ? "quotation-section-panel" : undefined}>
    {embedded ? <h3>Drink Selection</h3> : <h2>Drink Selection</h2>}
    <p className="step-copy">Select at least one service date before choosing drinks.</p>
  </div>;
  const order = data.drinkOrders[activeDate.id] ?? {};

  function toggleExcluded(beverage: Beverage, checked: boolean) {
    const nextExcluded = checked ? [...new Set([...excluded, beverage.id])] : excluded.filter((id) => id !== beverage.id);
    const nextOrder = { ...order, [beverage.id]: { ice: 0, hot: 0 } };
    setData({
      ...data,
      drinkOrders: { ...data.drinkOrders, [activeDate.id]: nextOrder },
      drinkDistributionModeByDate: { ...(data.drinkDistributionModeByDate ?? {}), [activeDate.id]: "HOUR_COFFEE_DECIDES" },
      excludedBeverageIdsByDate: { ...(data.excludedBeverageIdsByDate ?? {}), [activeDate.id]: nextExcluded },
      letHourCoffeeDecideDrinks: true
    });
  }

  return <div className={embedded ? "quotation-section-panel" : undefined}>
    {embedded ? <h3>Drink Selection</h3> : <h2>Drink Selection</h2>}<p className="step-copy">Hour Coffee will provide the selected drinks during the event. Disable any drinks you do not want us to serve.</p>
    {data.serviceDates.length > 1 ? <div className="tab-row">{data.serviceDates.map((date) => <button className={date.id === activeDate.id ? "active" : ""} type="button" key={date.id} onClick={() => setActiveDateId(date.id)}>{formatShortDate(date.serviceDate)}</button>)}</div> : null}
    <div className="beverage-card-grid">{beverages.map((beverage) => {
      const isExcluded = excluded.includes(beverage.id);
      return <article className={`beverage-choice-card ${isExcluded ? "excluded" : "enabled"}`} key={beverage.id}>
        {beverage.imageUrl ? <img src={beverage.imageUrl} alt={beverage.name} /> : <div className="beverage-image-placeholder">{beverage.name}</div>}
        <div className="beverage-card-heading"><h3>{beverage.name}</h3><span>{isExcluded ? "Disabled" : "Selected"}</span></div>{beverage.description ? <p>{beverage.description}</p> : null}
        <label className="exclude-drink"><input type="checkbox" checked={isExcluded} onChange={(event) => toggleExcluded(beverage, event.target.checked)} /> Disable this drink</label>
      </article>;
    })}</div>
    {isLoading ? <p className="muted-text">Loading available drinks...</p> : null}
    {!isLoading && !loadError && beverages.length === 0 ? <p className="error">No drinks are currently available.</p> : null}
    {hasInvalidDate ? <p className="error">Please keep at least one drink available for your event.</p> : null}{loadError ? <p className="error">{loadError}</p> : null}{error ? <p className="error">{error}</p> : null}
    {!embedded ? <StepNavigation onBack={onBack} onNext={onNext} nextDisabled={!valid} /> : null}
  </div>;
}
