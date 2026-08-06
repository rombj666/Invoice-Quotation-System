import { DrinkDistributionMode } from "@prisma/client";
import { prisma } from "./prisma";

type Quantity = { ice?: unknown; hot?: unknown };

function quantity(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function validateAndNormalizeDrinkSelections(data: any, allowHistorical = false): Promise<{ data?: any; error?: string }> {
  const beverages = await prisma.beverage.findMany();
  const byId = new Map(beverages.map((item) => [item.id, item]));
  const byLegacyKey = new Map(beverages.filter((item) => item.legacyKey).map((item) => [item.legacyKey!, item]));
  const active = beverages.filter((item) => item.isAvailable && !item.isArchived);
  if (!active.length) return { error: "No beverages are currently available." };

  const serviceDateIds = new Set<string>();
  const drinkOrders: Record<string, Record<string, { ice: number; hot: number }>> = {};
  const drinkDistributionModeByDate: Record<string, DrinkDistributionMode> = {};
  const excludedBeverageIdsByDate: Record<string, string[]> = {};
  const beverageSnapshots: Record<string, any> = {};

  for (const serviceDate of data.serviceDates ?? []) {
    if (serviceDateIds.has(serviceDate.id)) return { error: "Duplicate service-date mapping." };
    serviceDateIds.add(serviceDate.id);
    const requestedMode = data.drinkDistributionModeByDate?.[serviceDate.id]
      ?? (data.letHourCoffeeDecideDrinks ? "HOUR_COFFEE_DECIDES" : "MANUAL");
    if (requestedMode !== "MANUAL" && requestedMode !== "HOUR_COFFEE_DECIDES") return { error: `Invalid drink distribution mode for ${serviceDate.serviceDate}.` };
    drinkDistributionModeByDate[serviceDate.id] = requestedMode;

    const requestedExcluded = data.excludedBeverageIdsByDate?.[serviceDate.id] ?? [];
    if (!Array.isArray(requestedExcluded)) return { error: `Invalid excluded beverage list for ${serviceDate.serviceDate}.` };
    const excluded = new Set<string>();
    for (const requestedId of requestedExcluded) {
      const beverage = byId.get(String(requestedId)) ?? byLegacyKey.get(String(requestedId));
      if (!beverage) return { error: "An excluded beverage ID is invalid." };
      if ((!beverage.isAvailable || beverage.isArchived) && !allowHistorical) return { error: `${beverage.name} is unavailable or archived.` };
      if (excluded.has(beverage.id)) return { error: `Duplicate beverage selection for ${beverage.name}.` };
      excluded.add(beverage.id);
    }

    const normalizedOrder: Record<string, { ice: number; hot: number }> = {};
    const seen = new Set<string>();
    for (const [requestedId, raw] of Object.entries(data.drinkOrders?.[serviceDate.id] ?? {}) as Array<[string, Quantity]>) {
      const beverage = byId.get(requestedId) ?? byLegacyKey.get(requestedId);
      if (!beverage) return { error: `Invalid beverage ID: ${requestedId}.` };
      if (seen.has(beverage.id)) return { error: `Duplicate beverage selection for ${beverage.name}.` };
      seen.add(beverage.id);
      if ((!beverage.isAvailable || beverage.isArchived) && !allowHistorical) return { error: `${beverage.name} is unavailable or archived.` };
      const ice = quantity(raw?.ice);
      const hot = quantity(raw?.hot);
      if (ice === null || hot === null) return { error: `Drink quantities for ${beverage.name} must be non-negative whole numbers.` };
      if (!beverage.icedAvailable && ice > 0) return { error: `${beverage.name} is not available iced.` };
      if (!beverage.hotAvailable && hot > 0) return { error: `${beverage.name} is not available hot.` };
      if (excluded.has(beverage.id) && ice + hot > 0) return { error: `Excluded beverage ${beverage.name} cannot have a non-zero quantity.` };
      normalizedOrder[beverage.id] = { ice, hot };
      beverageSnapshots[beverage.id] = { id: beverage.id, name: beverage.name, imageUrl: beverage.imageUrl ?? undefined, icedAvailable: beverage.icedAvailable, hotAvailable: beverage.hotAvailable };
    }

    for (const beverage of active) {
      normalizedOrder[beverage.id] ??= { ice: 0, hot: 0 };
      beverageSnapshots[beverage.id] ??= { id: beverage.id, name: beverage.name, imageUrl: beverage.imageUrl ?? undefined, icedAvailable: beverage.icedAvailable, hotAvailable: beverage.hotAvailable };
    }
    excludedBeverageIdsByDate[serviceDate.id] = [...excluded];
    const allowedCount = active.filter((beverage) => !excluded.has(beverage.id)).length;
    if (allowedCount === 0) return { error: `At least one beverage must remain allowed for ${serviceDate.serviceDate}.` };
    if (requestedMode === "MANUAL") {
      const total = Object.entries(normalizedOrder).reduce((sum, [beverageId, item]) => excluded.has(beverageId) ? sum : sum + item.ice + item.hot, 0);
      if (total !== Number(serviceDate.cups)) return { error: `Drink quantities for ${serviceDate.serviceDate} must equal ${serviceDate.cups} cups.` };
    } else {
      for (const beverageId of Object.keys(normalizedOrder)) normalizedOrder[beverageId] = { ice: 0, hot: 0 };
    }
    drinkOrders[serviceDate.id] = normalizedOrder;
  }

  return { data: {
    ...data,
    drinkOrders,
    drinkDistributionModeByDate,
    excludedBeverageIdsByDate,
    beverageSnapshots,
    letHourCoffeeDecideDrinks: Object.values(drinkDistributionModeByDate).every((mode) => mode === "HOUR_COFFEE_DECIDES")
  } };
}
