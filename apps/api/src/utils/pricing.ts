type ServiceDate = {
  id: string;
  cups: number;
  startTime: string;
  endTime: string;
};

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
  const baseAmount = Math.max(totalCups * 10, 550);
  const setupFee = data.serviceDates.length > 0 && data.serviceDates.every((date) => date.cups < 100) ? 30 : 0;
  const extraBaristaFee = data.serviceDates.reduce((sum, date) => sum + getExtraBaristaFee(date), 0);
  const machineRentalFee = getMachineRentalFee(data.serviceDates, data.drinkOrders);
  const addonTotal = data.selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
  const cupSleeveFee = data.hasCupSleeves ? totalCups * (totalCups >= 150 ? 1.5 : 2) : 0;
  const cupStickerFee = data.hasCupStickers ? (totalCups <= 100 ? 50 : 50 + Math.ceil((totalCups - 100) / 100) * 10) : 0;
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
