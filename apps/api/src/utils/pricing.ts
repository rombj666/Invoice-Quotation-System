import { DEFAULT_SLEEVE_PRICING, DEFAULT_STICKER_PRICING, calculateSelectedAddonTotal, type CupSleevePricingConfig, type CupStickerPricingConfig } from "./addons";

type ServiceDate = {
  id: string;
  cups: number;
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
  drinkOrders: Record<string, Record<string, DrinkQuantity>>;
  selectedAddons: Array<{ name: string; price: number }>;
  hasCupSleeves: boolean;
  hasCupStickers: boolean;
  discountPercent: number;
  addonPricing?: {
    cupSticker?: CupStickerPricingConfig;
    cupSleeve?: CupSleevePricingConfig;
  };
};

function getDrinkTierRate(totalCups: number): number {
  if (totalCups >= 350) return 8;
  if (totalCups >= 200) return 8.5;
  if (totalCups >= 150) return 9;
  if (totalCups >= 100) return 9.5;
  return 10;
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
  return Math.max(0, getBaristasNeeded(date) - 1) * getServiceHoursBilled(date) * 30;
}

function getCaffeinatedCupsForDate(dateId: string, drinkOrders: Record<string, Record<string, DrinkQuantity>>): number {
  const order = drinkOrders[dateId] ?? {};
  const americano = order.americano ?? { ice: 0, hot: 0 };
  const latte = order.latte ?? { ice: 0, hot: 0 };
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
  const totalCups = data.serviceDates.reduce((sum, date) => sum + date.cups, 0);
  const baseAmount = totalCups * getDrinkTierRate(totalCups);
  const setupFee = data.serviceDates.length > 0 && data.serviceDates.every((date) => date.cups < 100) ? 30 : 0;
  const extraBaristaFee = data.serviceDates.reduce((sum, date) => sum + getExtraBaristaFee(date), 0);
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
  const subtotal = baseAmount + setupFee + extraBaristaFee + machineRentalFee + addonTotal + cupSleeveFee + cupStickerFee;
  const discountAmount = subtotal * ((data.discountPercent || 0) / 100);
  return {
    totalCups,
    baseAmount,
    setupFee,
    extraBaristaFee,
    machineRentalFee,
    addonTotal,
    cupSleeveFee,
    cupStickerFee,
    subtotal,
    discountAmount,
    total: subtotal - discountAmount
  };
}
