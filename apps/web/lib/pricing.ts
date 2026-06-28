import type { DrinkOrderByDate, QuotationAddon, QuotationData, ServiceDate } from "../types/quotation";

export type PricingBreakdown = {
  totalCups: number;
  baseAmount: number;
  setupFee: number;
  extraBaristaFee: number;
  machineRentalFee: number;
  addonTotal: number;
  cupSleeveFee: number;
  cupStickerFee: number;
  subtotal: number;
  discountAmount: number;
  total: number;
};

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

export function getCupSleevePrice(totalCups: number): number {
  return totalCups * (totalCups >= 150 ? 1.5 : 2);
}

export function getCupStickerPrice(totalCups: number): number {
  return totalCups <= 100 ? 50 : 50 + Math.ceil((totalCups - 100) / 100) * 10;
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

export function getSetupFee(serviceDates: ServiceDate[]): number {
  return serviceDates.length > 0 && serviceDates.every((date) => date.cups < 100) ? 30 : 0;
}

export function calculatePricing(data: QuotationData): PricingBreakdown {
  const totalCups = data.serviceDates.reduce((sum, date) => sum + date.cups, 0);
  const baseAmount = Math.max(totalCups * 10, 550);
  const setupFee = getSetupFee(data.serviceDates);
  const extraBaristaFee = data.serviceDates.reduce((sum, date) => sum + getExtraBaristaFee(date), 0);
  const machineRentalFee = getMachineRentalFee(data.serviceDates, data.drinkOrders);
  const addonTotal = data.selectedAddons.reduce((sum: number, addon: QuotationAddon) => sum + addon.price, 0);
  const cupSleeveFee = data.hasCupSleeves ? getCupSleevePrice(totalCups) : 0;
  const cupStickerFee = data.hasCupStickers ? getCupStickerPrice(totalCups) : 0;
  const subtotal = baseAmount + setupFee + extraBaristaFee + machineRentalFee + addonTotal + cupSleeveFee + cupStickerFee;
  const discountAmount = subtotal * ((data.discountPercent || 0) / 100);
  const total = subtotal - discountAmount;

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
    total
  };
}
