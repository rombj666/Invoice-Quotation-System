"use client";

import { useEffect, useMemo, useState } from "react";
import { loadBeverages, type Beverage } from "../../lib/beverages";
import { formatShortDate } from "../../lib/formatters";
import type { QuotationData } from "../../types/quotation";
import { StepNavigation } from "../common/StepNavigation";

type Props = { data: QuotationData; setData: (data: QuotationData) => void; onBack: () => void; onNext: () => void; error: string };
const legacyIds: Record<string, string> = { americano: "bev_americano", latte: "bev_cafe_latte", chocolate: "bev_dark_chocolate", lemonade: "bev_lemonade" };

export function DrinkPreferencesStep({ data, setData, onBack, onNext, error }: Props) {
  const [beverages, setBeverages] = useState<Beverage[]>([]);
  const [activeDateId, setActiveDateId] = useState(data.serviceDates[0]?.id ?? "");
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const activeDate = useMemo(() => data.serviceDates.find((date) => date.id === activeDateId) ?? data.serviceDates[0], [activeDateId, data.serviceDates]);
  const excluded = activeDate ? data.excludedBeverageIdsByDate?.[activeDate.id] ?? [] : [];

  useEffect(() => {
    loadBeverages().then((loaded) => {
      setBeverages(loaded);
      const snapshots: NonNullable<QuotationData["beverageSnapshots"]> = {};
      loaded.forEach((item) => { snapshots[item.id] = { id: item.id, name: item.name, imageUrl: item.imageUrl, icedAvailable: item.icedAvailable, hotAvailable: item.hotAvailable }; });
      const orders = { ...data.drinkOrders };
      const exclusions = { ...(data.excludedBeverageIdsByDate ?? {}) };
      const availableIds = new Set(loaded.map((item) => item.id));
      for (const date of data.serviceDates) {
        orders[date.id] = Object.fromEntries(loaded.map((item) => [item.id, { ice: 0, hot: 0 }]));
        exclusions[date.id] = [...new Set((exclusions[date.id] ?? []).map((id) => legacyIds[id] ?? id))].filter((id) => availableIds.has(id));
      }
      setData({
        ...data,
        drinkOrders: orders,
        beverageSnapshots: snapshots,
        drinkDistributionModeByDate: Object.fromEntries(data.serviceDates.map((date) => [date.id, "HOUR_COFFEE_DECIDES"])),
        excludedBeverageIdsByDate: exclusions,
        letHourCoffeeDecideDrinks: true
      });
    }).catch(() => setLoadError("Unable to load the beverage catalog."))
      .finally(() => setIsLoading(false));
    // Catalog initialization is intentionally performed once on entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!activeDate) return null;
  const order = data.drinkOrders[activeDate.id] ?? {};
  const hasInvalidDate = data.serviceDates.some((date) => beverages.length > 0 && beverages.every((item) => data.excludedBeverageIdsByDate?.[date.id]?.includes(item.id)));
  const valid = !isLoading && beverages.length > 0 && !hasInvalidDate;

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

  return <div>
    <h2>Drink preferences</h2><p className="step-copy">Hour Coffee will manage the drink selection and distribution during your event. Please select any drinks you do not want us to serve.</p>
    {data.serviceDates.length > 1 ? <div className="tab-row">{data.serviceDates.map((date) => <button className={date.id === activeDate.id ? "active" : ""} type="button" key={date.id} onClick={() => setActiveDateId(date.id)}>{formatShortDate(date.serviceDate)}</button>)}</div> : null}
    <div className="beverage-card-grid">{beverages.map((beverage) => {
      const isExcluded = excluded.includes(beverage.id);
      return <article className={`beverage-choice-card ${isExcluded ? "excluded" : ""}`} key={beverage.id}>
        {beverage.imageUrl ? <img src={beverage.imageUrl} alt={beverage.name} /> : <div className="beverage-image-placeholder">{beverage.name}</div>}
        <h3>{beverage.name}</h3>{beverage.description ? <p>{beverage.description}</p> : null}
        <label className="exclude-drink"><input type="checkbox" checked={isExcluded} onChange={(event) => toggleExcluded(beverage, event.target.checked)} /> Do not include this drink</label>
      </article>;
    })}</div>
    {!isLoading && !loadError && beverages.length === 0 ? <p className="error">No drinks are currently available.</p> : null}
    {hasInvalidDate ? <p className="error">Please keep at least one drink available for your event.</p> : null}{loadError ? <p className="error">{loadError}</p> : null}{error ? <p className="error">{error}</p> : null}
    <StepNavigation onBack={onBack} onNext={onNext} nextDisabled={!valid} />
  </div>;
}
