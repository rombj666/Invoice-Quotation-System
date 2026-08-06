import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/utils/prisma";
import { validateAndNormalizeDrinkSelections } from "../src/utils/drink-selection";

const catalog = [
  { id: "coffee", legacyKey: "coffee", name: "Coffee", imageUrl: null, icedAvailable: true, hotAvailable: true, isAvailable: true, isArchived: false },
  { id: "lemon", legacyKey: "lemon", name: "Lemonade", imageUrl: null, icedAvailable: true, hotAvailable: false, isAvailable: true, isArchived: false },
  { id: "old", legacyKey: "old", name: "Archived", imageUrl: null, icedAvailable: true, hotAvailable: true, isAvailable: false, isArchived: true }
];

(prisma.beverage.findMany as any) = async () => catalog;
const dates = [{ id: "a", serviceDate: "2026-09-30", cups: 50 }, { id: "b", serviceDate: "2026-10-01", cups: 60 }];

test("manual quantities must match each service date", async () => {
  const valid = await validateAndNormalizeDrinkSelections({ serviceDates: [dates[0]], drinkOrders: { a: { coffee: { ice: 30, hot: 10 }, lemon: { ice: 10, hot: 0 } } }, drinkDistributionModeByDate: { a: "MANUAL" }, excludedBeverageIdsByDate: { a: [] } });
  assert.equal(valid.error, undefined);
  const invalid = await validateAndNormalizeDrinkSelections({ serviceDates: [dates[0]], drinkOrders: { a: { coffee: { ice: 20, hot: 0 } } }, drinkDistributionModeByDate: { a: "MANUAL" } });
  assert.match(invalid.error ?? "", /must equal 50 cups/);
});

test("Hour Coffee decides allows zero quantities and retains per-date exclusions", async () => {
  const result = await validateAndNormalizeDrinkSelections({ serviceDates: dates, drinkOrders: { a: {}, b: {} }, drinkDistributionModeByDate: { a: "HOUR_COFFEE_DECIDES", b: "HOUR_COFFEE_DECIDES" }, excludedBeverageIdsByDate: { a: ["lemon"], b: ["coffee"] } });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.data.excludedBeverageIdsByDate, { a: ["lemon"], b: ["coffee"] });
});

test("every available beverage cannot be excluded", async () => {
  const result = await validateAndNormalizeDrinkSelections({ serviceDates: [dates[0]], drinkOrders: { a: {} }, drinkDistributionModeByDate: { a: "HOUR_COFFEE_DECIDES" }, excludedBeverageIdsByDate: { a: ["coffee", "lemon"] } });
  assert.match(result.error ?? "", /At least one beverage/);
});

test("excluded beverages cannot have non-zero quantities", async () => {
  const result = await validateAndNormalizeDrinkSelections({ serviceDates: [dates[0]], drinkOrders: { a: { coffee: { ice: 50, hot: 0 } } }, drinkDistributionModeByDate: { a: "MANUAL" }, excludedBeverageIdsByDate: { a: ["coffee"] } });
  assert.match(result.error ?? "", /cannot have a non-zero quantity/);
});

test("cold-only and archived beverages are rejected", async () => {
  const hot = await validateAndNormalizeDrinkSelections({ serviceDates: [dates[0]], drinkOrders: { a: { lemon: { ice: 49, hot: 1 } } }, drinkDistributionModeByDate: { a: "MANUAL" } });
  assert.match(hot.error ?? "", /not available hot/);
  const archived = await validateAndNormalizeDrinkSelections({ serviceDates: [dates[0]], drinkOrders: { a: { old: { ice: 50, hot: 0 } } }, drinkDistributionModeByDate: { a: "MANUAL" } });
  assert.match(archived.error ?? "", /unavailable or archived/);
});
