import { DEFAULT_SLEEVE_PRICING, DEFAULT_STICKER_PRICING, calculateSelectedAddonTotal, type CupSleevePricingConfig, type CupStickerPricingConfig } from "./addons";

type ServiceDate = {
  id: string;
  cups: number;
  durationMode?: "HALF_DAY" | "FULL_DAY";
  startTime: string;
  endTime: string;
};

export function hasValidServiceDates(value: unknown): value is ServiceDate[] {
  return Array.isArray(value) && value.length > 0 && value.every((date) => {
    if (!date || typeof date !== "object") return false;
    const candidate = date as Partial<ServiceDate>;
    return typeof candidate.id === "string" && candidate.id.length > 0 && Number.isInteger(candidate.cups) && Number(candidate.cups) >= 50;
  });
}

type DrinkQuantity = {
  ice: number;
  hot: number;
};

type QuotationPayload = {
  serviceDates: ServiceDate[];
  totalCups?: number;
  serviceDuration?: "HALF_DAY" | "FULL_DAY";
  drinkOrders: Record<string, Record<string, DrinkQuantity>>;
  selectedAddons: Array<{ name: string; price: number }>;
  hasCupSleeves: boolean;
  hasCupStickers: boolean;
  discountPercent: number;
  addonPricing?: {
    cupSticker?: CupStickerPricingConfig;
    cupSleeve?: CupSleevePricingConfig;
  };
  packageSnapshot?: { price: number };
};

type ManualExtraCharge = {
  title?: string;
  amount: number | string | { toString(): string };
};

export const EXTRA_SERVING_HOUR_RATE = 50;

export type ExtraServingHourBreakdown = {
  serviceDateId: string;
  date: string;
  cups: number;
  exactServiceHours: number;
  extraServingHours: number;
  rate: number;
  fee: number;
};

export function getExtraServingHourBreakdown(serviceDates: ServiceDate[]): ExtraServingHourBreakdown[] {
  return serviceDates.map((date: ServiceDate & { serviceDate?: string }) => {
    const exactServiceHours = getServiceHoursExact(date);
    const extraServingHours = date.durationMode ? 0 : date.cups < 100 ? Math.max(0, Math.ceil(exactServiceHours - 4)) : 0;
    return {
      serviceDateId: date.id,
      date: date.serviceDate ?? "",
      cups: date.cups,
      exactServiceHours,
      extraServingHours,
      rate: EXTRA_SERVING_HOUR_RATE,
      fee: extraServingHours * EXTRA_SERVING_HOUR_RATE
    };
  });
}

const COFFEE_CATERING_TIERS = [
  { minimumCups: 50, maximumCups: 99, rate: 10 },
  { minimumCups: 100, maximumCups: 149, rate: 9.5 },
  { minimumCups: 150, maximumCups: 199, rate: 9 },
  { minimumCups: 200, maximumCups: 349, rate: 8.5 },
  { minimumCups: 350, maximumCups: Number.POSITIVE_INFINITY, rate: 8 }
] as const;

export function getCoffeeCateringRate(totalCups: number): number {
  return COFFEE_CATERING_TIERS.find((tier) => totalCups >= tier.minimumCups && totalCups <= tier.maximumCups)?.rate
    ?? COFFEE_CATERING_TIERS[0].rate;
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
  return Math.max(0, getBaristasNeeded(date) - 1) * getServiceHoursBilled(date) * 30;
}

export function getFullDayBaristaFeeBreakdown(serviceDates: ServiceDate[]) {
  return serviceDates
    .filter((date) => date.durationMode === "FULL_DAY")
    .map((date: ServiceDate & { serviceDate?: string }) => ({
      serviceDateId: date.id,
      date: date.serviceDate ?? "",
      cups: date.cups,
      baristas: getBaristasNeeded(date),
      fee: getExtraBaristaFee(date)
    }));
}

export function getQuotationBaristaPricing(totalCups: number, duration: "HALF_DAY" | "FULL_DAY") {
  if (!Number.isInteger(totalCups) || totalCups < 50) {
    return { requiredBaristas: 0, extraBaristas: 0, extraBaristaFee: 0 };
  }
  const cupsPerBarista = duration === "FULL_DAY" ? 200 : 100;
  const requiredBaristas = Math.ceil(totalCups / cupsPerBarista);
  const extraBaristas = Math.max(requiredBaristas - 1, 0);
  return { requiredBaristas, extraBaristas, extraBaristaFee: extraBaristas * 100 };
}

export function getQuotationExtraBaristas(totalCups: number, duration: "HALF_DAY" | "FULL_DAY"): number {
  return getQuotationBaristaPricing(totalCups, duration).extraBaristas;
}

export function getQuotationExtraBaristaFee(totalCups: number, duration: "HALF_DAY" | "FULL_DAY"): number {
  return getQuotationBaristaPricing(totalCups, duration).extraBaristaFee;
}

function getCaffeinatedCupsForDate(dateId: string, drinkOrders: Record<string, Record<string, DrinkQuantity>>): number {
  const order = drinkOrders[dateId] ?? {};
  const americano = order.bev_americano ?? order.americano ?? { ice: 0, hot: 0 };
  const latte = order.bev_cafe_latte ?? order.latte ?? { ice: 0, hot: 0 };
  return americano.ice + americano.hot + latte.ice + latte.hot;
}

function getMachineRentalFee(serviceDates: ServiceDate[], drinkOrders: Record<string, Record<string, DrinkQuantity>>): number {
  const maxRate = serviceDates.reduce((highest, date) => {
    const cupsPerHour = getCaffeinatedCupsForDate(date.id, drinkOrders) / getServiceHoursExact(date);
    return Math.max(highest, cupsPerHour);
  }, 0);
  const machinesNeeded = Math.ceil(maxRate / 50);
  return Math.max(0, machinesNeeded - 1) * 350;
}

export function calculatePricing(data: QuotationPayload) {
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
  const sleeve = data.addonPricing?.cupSleeve ?? DEFAULT_SLEEVE_PRICING;
  const sticker = data.addonPricing?.cupSticker ?? DEFAULT_STICKER_PRICING;
  const cupSleeveFee = data.hasCupSleeves ? totalCups * (totalCups >= sleeve.threshold ? sleeve.rateAtOrAboveThreshold : sleeve.rateBelowThreshold) : 0;
  const cupStickerFee = data.hasCupStickers
    ? totalCups <= sticker.baseCupLimit
      ? sticker.basePrice
      : sticker.basePrice + Math.ceil((totalCups - sticker.baseCupLimit) / sticker.additionalTierCups) * sticker.additionalTierPrice
    : 0;
  const extraServingHoursByDate = getExtraServingHourBreakdown(data.serviceDates);
  const totalExtraServingHourFee = extraServingHoursByDate.reduce((sum, entry) => sum + entry.fee, 0);
  const subtotal = baseAmount + extraBaristaFee + machineRentalFee + addonTotal + cupSleeveFee + cupStickerFee + totalExtraServingHourFee;
  const discountAmount = subtotal * ((data.discountPercent || 0) / 100);
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
    total: subtotal - discountAmount
  };
}

export function calculateQuotationPricing(data: QuotationPayload, extraCharges: ManualExtraCharge[] = []) {
  const pricing = calculatePricing(data);
  const manualExtraChargeTotal = extraCharges
    .filter((charge) => String(charge.title ?? "").trim().toLowerCase() !== "extra serving hour")
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
