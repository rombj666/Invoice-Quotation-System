import type { CupSleevePricingConfig, CupStickerPricingConfig, DrinkOrderByDate, FullDayBaristaFeeBreakdown, QuotationData, ServiceDate, ServiceDurationMode } from "../types/quotation";
import { DEFAULT_ADDON_PRICING, calculateSelectedAddonTotal } from "./addons";

export type PricingBreakdown = {
  totalCups: number;
  baseAmount: number;
  requiredBaristas: number;
  extraBaristas: number;
  extraBaristaFee: number;
  fullDayBaristaFeesByDate: FullDayBaristaFeeBreakdown[];
  machineRentalFee: number;
  addonTotal: number;
  cupSleeveFee: number;
  cupStickerFee: number;
  extraServingHoursByDate: Array<{ serviceDateId: string; date: string; cups: number; exactServiceHours: number; extraServingHours: number; rate: number; fee: number }>;
  extraServingHourRate: number;
  extraServingHourFeeByDate: Array<{ serviceDateId: string; date: string; cups: number; exactServiceHours: number; extraServingHours: number; rate: number; fee: number }>;
  totalExtraServingHourFee: number;
  subtotal: number;
  discountAmount: number;
  total: number;
};

export const EXTRA_SERVING_HOUR_RATE = 50;

export function getExtraServingHourBreakdown(serviceDates: ServiceDate[]) {
  return serviceDates.map((date) => {
    const exactServiceHours = getServiceHoursExact(date);
    const extraServingHours = date.durationMode ? 0 : date.cups < 100 ? Math.max(0, Math.ceil(exactServiceHours - 4)) : 0;
    return { serviceDateId: date.id, date: date.serviceDate, cups: date.cups, exactServiceHours, extraServingHours, rate: EXTRA_SERVING_HOUR_RATE, fee: extraServingHours * EXTRA_SERVING_HOUR_RATE };
  });
}

export type QuotationPricingBreakdown = PricingBreakdown & {
  manualExtraChargeTotal: number;
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
  if (date.durationMode === "FULL_DAY") return 8;
  if (date.durationMode === "HALF_DAY") return 4;
  if (!date.startTime || !date.endTime) return 4;
  return Math.max(0.25, (timeToMinutes(date.endTime) - timeToMinutes(date.startTime)) / 60);
}

export function getServiceHoursBilled(date: ServiceDate): number {
  return Math.ceil(getServiceHoursExact(date));
}

export function getBaristasNeeded(date: ServiceDate): number {
  if (date.durationMode) return Math.max(1, Math.ceil(date.cups / 100));
  return Math.ceil(date.cups / (50 * getServiceHoursExact(date)));
}

export function getExtraBaristaFee(date: ServiceDate): number {
  if (date.durationMode) return date.durationMode === "FULL_DAY" ? getBaristasNeeded(date) * 100 : 0;
  const extraBaristas = Math.max(0, getBaristasNeeded(date) - 1);
  return extraBaristas * getServiceHoursBilled(date) * 30;
}

export function getDurationMode(date: ServiceDate): ServiceDurationMode {
  return date.durationMode ?? (getServiceHoursExact(date) > 4 ? "FULL_DAY" : "HALF_DAY");
}

export function getDurationLabel(date: ServiceDate): string {
  return getDurationMode(date) === "FULL_DAY" ? "Full Day" : "Half Day";
}

export function getFullDayBaristaFeeBreakdown(serviceDates: ServiceDate[]): FullDayBaristaFeeBreakdown[] {
  return serviceDates
    .filter((date) => date.durationMode === "FULL_DAY")
    .map((date) => ({
      serviceDateId: date.id,
      date: date.serviceDate,
      cups: date.cups,
      baristas: getBaristasNeeded(date),
      fee: getExtraBaristaFee(date)
    }));
}

export function getQuotationBaristaPricing(totalCups: number, duration: ServiceDurationMode) {
  if (!Number.isInteger(totalCups) || totalCups < 50) {
    return { requiredBaristas: 0, extraBaristas: 0, extraBaristaFee: 0 };
  }
  const cupsPerBarista = duration === "FULL_DAY" ? 200 : 100;
  const requiredBaristas = Math.ceil(totalCups / cupsPerBarista);
  const extraBaristas = Math.max(requiredBaristas - 1, 0);
  return { requiredBaristas, extraBaristas, extraBaristaFee: extraBaristas * 100 };
}

export function getQuotationExtraBaristas(totalCups: number, duration: ServiceDurationMode): number {
  return getQuotationBaristaPricing(totalCups, duration).extraBaristas;
}

export function getQuotationExtraBaristaFee(totalCups: number, duration: ServiceDurationMode): number {
  return getQuotationBaristaPricing(totalCups, duration).extraBaristaFee;
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
  const americano = order.bev_americano ?? order.americano ?? { ice: 0, hot: 0 };
  const latte = order.bev_cafe_latte ?? order.latte ?? { ice: 0, hot: 0 };
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
  const hasQuotationLevelSettings = Number.isFinite(data.totalCups) && Boolean(data.serviceDuration);
  const totalCups = hasQuotationLevelSettings ? Number(data.totalCups) : data.serviceDates.reduce((sum, date) => sum + date.cups, 0);
  if (data.packageSnapshot && Number.isFinite(Number(data.packageSnapshot.price))) {
    const subtotal = Number(data.packageSnapshot.price);
    const discountAmount = subtotal * ((data.discountPercent || 0) / 100);
    const baristaPricing = getQuotationBaristaPricing(totalCups, data.serviceDuration ?? "HALF_DAY");
    return {
      totalCups,
      baseAmount: subtotal,
      requiredBaristas: baristaPricing.requiredBaristas,
      extraBaristas: baristaPricing.extraBaristas,
      extraBaristaFee: 0,
      fullDayBaristaFeesByDate: [],
      machineRentalFee: 0,
      addonTotal: 0,
      cupSleeveFee: 0,
      cupStickerFee: 0,
      extraServingHoursByDate: [],
      extraServingHourRate: EXTRA_SERVING_HOUR_RATE,
      extraServingHourFeeByDate: [],
      totalExtraServingHourFee: 0,
      subtotal,
      discountAmount,
      total: subtotal - discountAmount
    };
  }
  const baseAmount = totalCups * getCoffeeCateringRate(totalCups);
  const quotationBaristaPricing = hasQuotationLevelSettings ? getQuotationBaristaPricing(totalCups, data.serviceDuration!) : null;
  const requiredBaristas = quotationBaristaPricing?.requiredBaristas ?? 0;
  const extraBaristas = quotationBaristaPricing?.extraBaristas ?? 0;
  const extraBaristaFee = quotationBaristaPricing?.extraBaristaFee ?? data.serviceDates.reduce((sum, date) => sum + getExtraBaristaFee(date), 0);
  const fullDayBaristaFeesByDate = hasQuotationLevelSettings ? [] : getFullDayBaristaFeeBreakdown(data.serviceDates);
  const machineRentalFee = getMachineRentalFee(data.serviceDates, data.drinkOrders);
  const addonTotal = calculateSelectedAddonTotal(data.selectedAddons);
  const cupSleeveFee = data.hasCupSleeves ? getCupSleevePrice(totalCups, data.addonPricing?.cupSleeve) : 0;
  const cupStickerFee = data.hasCupStickers ? getCupStickerPrice(totalCups, data.addonPricing?.cupSticker) : 0;
  const extraServingHoursByDate = getExtraServingHourBreakdown(data.serviceDates);
  const totalExtraServingHourFee = extraServingHoursByDate.reduce((sum, entry) => sum + entry.fee, 0);
  const subtotal = baseAmount + extraBaristaFee + machineRentalFee + addonTotal + cupSleeveFee + cupStickerFee + totalExtraServingHourFee;
  const discountAmount = subtotal * ((data.discountPercent || 0) / 100);
  const total = subtotal - discountAmount;

  return {
    totalCups,
    baseAmount,
    requiredBaristas,
    extraBaristas,
    extraBaristaFee,
    fullDayBaristaFeesByDate,
    machineRentalFee,
    addonTotal,
    cupSleeveFee,
    cupStickerFee,
    extraServingHoursByDate,
    extraServingHourRate: EXTRA_SERVING_HOUR_RATE,
    extraServingHourFeeByDate: extraServingHoursByDate,
    totalExtraServingHourFee,
    subtotal,
    discountAmount,
    total
  };
}

export function calculateQuotationPricing(data: QuotationData): QuotationPricingBreakdown {
  const pricing = calculatePricing(data);
  const manualExtraChargeTotal = (data.extraCharges ?? [])
    .filter((charge) => charge.title.trim().toLowerCase() !== "extra serving hour")
    .reduce((sum, charge) => sum + Number(charge.amount), 0);
  const subtotal = pricing.subtotal + manualExtraChargeTotal;
  const discountAmount = subtotal * ((data.discountPercent || 0) / 100);

  return {
    ...pricing,
    manualExtraChargeTotal,
    subtotal,
    discountAmount,
    total: subtotal - discountAmount
  };
}
