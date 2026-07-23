import type { CupSleevePricingConfig, CupStickerPricingConfig, DrinkOrderByDate, QuotationData, ServiceDate } from "../types/quotation";
import { DEFAULT_ADDON_PRICING, calculateSelectedAddonTotal } from "./addons";

export type PricingBreakdown = {
  totalCups: number;
  baseAmount: number;
  extraBaristaFee: number;
  machineRentalFee: number;
  addonTotal: number;
  cupSleeveFee: number;
  cupStickerFee: number;
  subtotal: number;
  discountAmount: number;
  total: number;
};

export const COFFEE_CATERING_TIERS = [
  { minimumCups: 50, maximumCups: 99, cupsLabel: "50–99 cups", rate: 10, rateLabel: "RM10 per cup" },
  { minimumCups: 100, maximumCups: 149, cupsLabel: "100–149 cups", rate: 9.5, rateLabel: "RM9.50 per cup" },
  { minimumCups: 150, maximumCups: 199, cupsLabel: "150–199 cups", rate: 9, rateLabel: "RM9 per cup" },
  { minimumCups: 200, maximumCups: 349, cupsLabel: "200–349 cups", rate: 8.5, rateLabel: "RM8.50 per cup" },
  { minimumCups: 350, maximumCups: Number.POSITIVE_INFINITY, cupsLabel: "350 cups and above", rate: 8, rateLabel: "RM8 per cup" }
] as const;

export function getCoffeeCateringTier(totalCups: number) {
  return COFFEE_CATERING_TIERS.find((tier) => totalCups >= tier.minimumCups && totalCups <= tier.maximumCups)
    ?? COFFEE_CATERING_TIERS[0];
}

export function getCoffeeCateringRate(totalCups: number): number {
  return getCoffeeCateringTier(totalCups).rate;
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getServiceHoursExact(date: ServiceDate): number {
  if (!date.startTime || !date.endTime) return 4;
  return Math.max(0.25, (timeToMinutes(date.endTime) - timeToMinutes(date.startTime)) / 60);
}

export function getServiceHoursBilled(date: ServiceDate): number {
  return Math.ceil(getServiceHoursExact(date));
}

export function getBaristasNeeded(date: ServiceDate): number {
  return Math.ceil(date.cups / (50 * getServiceHoursExact(date)));
}

export function getExtraBaristaFee(date: ServiceDate): number {
  const extraBaristas = Math.max(0, getBaristasNeeded(date) - 1);
  return extraBaristas * getServiceHoursBilled(date) * 30;
}

export function getCupSleevePrice(totalCups: number, config: CupSleevePricingConfig = DEFAULT_ADDON_PRICING.cupSleeve): number {
  return totalCups * (totalCups >= config.threshold ? config.rateAtOrAboveThreshold : config.rateBelowThreshold);
}

export function getCupStickerPrice(totalCups: number, config: CupStickerPricingConfig = DEFAULT_ADDON_PRICING.cupSticker): number {
  return totalCups <= config.baseCupLimit
    ? config.basePrice
    : config.basePrice + Math.ceil((totalCups - config.baseCupLimit) / config.additionalTierCups) * config.additionalTierPrice;
}

export function getCaffeinatedCupsForDate(dateId: string, drinkOrders: DrinkOrderByDate): number {
  const order = drinkOrders[dateId] ?? {};
  const americano = order.americano ?? { ice: 0, hot: 0 };
  const latte = order.latte ?? { ice: 0, hot: 0 };
  return americano.ice + americano.hot + latte.ice + latte.hot;
}

export function getMachineRentalFee(serviceDates: ServiceDate[], drinkOrders: DrinkOrderByDate): number {
  const maxRate = serviceDates.reduce((highest, date) => {
    const cupsPerHour = getCaffeinatedCupsForDate(date.id, drinkOrders) / getServiceHoursExact(date);
    return Math.max(highest, cupsPerHour);
  }, 0);
  const machinesNeeded = Math.ceil(maxRate / 50);
  return Math.max(0, machinesNeeded - 1) * 350;
}

export function calculatePricing(data: QuotationData): PricingBreakdown {
  const totalCups = data.serviceDates.reduce((sum, date) => sum + date.cups, 0);
  const baseAmount = totalCups * getCoffeeCateringRate(totalCups);
  const extraBaristaFee = data.serviceDates.reduce((sum, date) => sum + getExtraBaristaFee(date), 0);
  const machineRentalFee = getMachineRentalFee(data.serviceDates, data.drinkOrders);
  const addonTotal = calculateSelectedAddonTotal(data.selectedAddons);
  const cupSleeveFee = data.hasCupSleeves ? getCupSleevePrice(totalCups, data.addonPricing?.cupSleeve) : 0;
  const cupStickerFee = data.hasCupStickers ? getCupStickerPrice(totalCups, data.addonPricing?.cupSticker) : 0;
  const subtotal = baseAmount + extraBaristaFee + machineRentalFee + addonTotal + cupSleeveFee + cupStickerFee;
  const discountAmount = subtotal * ((data.discountPercent || 0) / 100);
  const total = subtotal - discountAmount;

  return {
    totalCups,
    baseAmount,
    extraBaristaFee,
    machineRentalFee,
    addonTotal,
    cupSleeveFee,
    cupStickerFee,
    subtotal,
    discountAmount,
    total
  };
}
