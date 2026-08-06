import assert from "node:assert/strict";
import test from "node:test";
import { calculatePricing, calculateQuotationPricing, getExtraServingHourBreakdown } from "../src/utils/pricing";

const date = (cups: number, endTime: string, id = "date-1") => ({ id, serviceDate: "2026-09-30", cups, startTime: "10:00", endTime });
const quote = (serviceDates: ReturnType<typeof date>[]) => ({ serviceDates, drinkOrders: {}, selectedAddons: [], hasCupSleeves: false, hasCupStickers: false, discountPercent: 0 });

test("extra serving hour boundaries are calculated from exact duration", () => {
  assert.equal(getExtraServingHourBreakdown([date(99, "14:00")])[0].fee, 0);
  assert.equal(getExtraServingHourBreakdown([date(99, "14:30")])[0].fee, 50);
  assert.equal(getExtraServingHourBreakdown([date(99, "15:00")])[0].fee, 50);
  assert.equal(getExtraServingHourBreakdown([date(99, "15:30")])[0].fee, 100);
  assert.equal(getExtraServingHourBreakdown([date(55, "18:00")])[0].fee, 200);
});

test("100 cups and above never receive an extra serving hour fee", () => {
  assert.equal(getExtraServingHourBreakdown([date(100, "16:00")])[0].fee, 0);
  assert.equal(getExtraServingHourBreakdown([date(150, "18:00")])[0].fee, 0);
});

test("service dates are assessed independently and summed", () => {
  const pricing = calculatePricing(quote([date(55, "16:00", "a"), date(120, "16:00", "b")]));
  assert.equal(pricing.extraServingHoursByDate[0].fee, 100);
  assert.equal(pricing.extraServingHoursByDate[1].fee, 0);
  assert.equal(pricing.totalExtraServingHourFee, 100);
});

test("manual Extra Serving Hour records cannot duplicate the automatic fee", () => {
  const pricing = calculateQuotationPricing(quote([date(55, "16:00")]), [{ title: "Extra Serving Hour", amount: 999 }]);
  assert.equal(pricing.totalExtraServingHourFee, 100);
  assert.equal(pricing.manualExtraChargeTotal, 0);
});

test("a manipulated browser fee is ignored", () => {
  const pricing = calculatePricing({ ...quote([date(55, "16:00")]), totalExtraServingHourFee: 99999 } as any);
  assert.equal(pricing.totalExtraServingHourFee, 100);
});
