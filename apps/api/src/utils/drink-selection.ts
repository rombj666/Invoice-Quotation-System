import { DrinkDistributionMode } from "@prisma/client";
import { prisma } from "./prisma";

export async function validateAndNormalizeDrinkSelections(data: any, allowHistorical = false): Promise<{ data?: any; error?: string }> {
  const beverages = await prisma.beverage.findMany();
  const byId = new Map(beverages.map((item) => [item.id, item]));
  const byLegacyKey = new Map(beverages.filter((item) => item.legacyKey).map((item) => [item.legacyKey!, item]));
  const active = beverages.filter((item) => item.isAvailable && !item.isArchived);
  if (!active.length && !allowHistorical) return { error: "No drinks are currently available." };

  const serviceDateIds = new Set<string>();
  const drinkOrders: Record<string, Record<string, { ice: number; hot: number }>> = {};
  const drinkDistributionModeByDate: Record<string, DrinkDistributionMode> = {};
  const excludedBeverageIdsByDate: Record<string, string[]> = {};
  const beverageSnapshots: Record<string, any> = {};

  for (const serviceDate of data.serviceDates ?? []) {
    if (serviceDateIds.has(serviceDate.id)) return { error: "Duplicate service-date mapping." };
    serviceDateIds.add(serviceDate.id);
    drinkDistributionModeByDate[serviceDate.id] = "HOUR_COFFEE_DECIDES";

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
    for (const requestedId of Object.keys(data.drinkOrders?.[serviceDate.id] ?? {})) {
      const beverage = byId.get(requestedId) ?? byLegacyKey.get(requestedId);
      if (!beverage) return { error: `Invalid beverage ID: ${requestedId}.` };
      if ((!beverage.isAvailable || beverage.isArchived) && !allowHistorical) continue;
      if (seen.has(beverage.id)) return { error: `Duplicate beverage selection for ${beverage.name}.` };
      seen.add(beverage.id);
      normalizedOrder[beverage.id] = { ice: 0, hot: 0 };
      beverageSnapshots[beverage.id] = { id: beverage.id, name: beverage.name, imageUrl: beverage.imageUrl ?? undefined, icedAvailable: beverage.icedAvailable, hotAvailable: beverage.hotAvailable };
    }

    for (const beverage of active) {
      normalizedOrder[beverage.id] ??= { ice: 0, hot: 0 };
      beverageSnapshots[beverage.id] ??= { id: beverage.id, name: beverage.name, imageUrl: beverage.imageUrl ?? undefined, icedAvailable: beverage.icedAvailable, hotAvailable: beverage.hotAvailable };
    }
    excludedBeverageIdsByDate[serviceDate.id] = [...excluded];
    const allowedIds = allowHistorical ? Object.keys(normalizedOrder) : active.map((beverage) => beverage.id);
    const allowedCount = allowedIds.filter((beverageId) => !excluded.has(beverageId)).length;
    if (allowedCount === 0) return { error: "Please keep at least one drink available for your event." };
    drinkOrders[serviceDate.id] = normalizedOrder;
  }

  return { data: {
    ...data,
    drinkOrders,
    drinkDistributionModeByDate,
    excludedBeverageIdsByDate,
    beverageSnapshots,
    letHourCoffeeDecideDrinks: true
  } };
}
