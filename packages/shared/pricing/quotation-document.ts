import { PACKAGE_CODES, calculateQuotationPricing, getQuotationBaristaPricing, type CartStyle, type PackageCode, type PackageOptionCode, type PricingInput } from "./index";

type QuotationDocumentInput = {
  totalCups?: number;
  serviceDuration?: "HALF_DAY" | "FULL_DAY";
  serviceDates: Array<{ id: string; serviceDate?: string; cups: number; durationMode?: "HALF_DAY" | "FULL_DAY"; startTime: string; endTime: string }>;
  packageCode?: string;
  cartStyle?: CartStyle;
  selectedOptions?: PackageOptionCode[];
  packageSnapshot?: { price: number; packageCode?: string; level?: string; perks?: Array<{ name: string }> };
  pricingSnapshot?: { subtotal: number; total: number; discountAmount: number; packageAmount?: number };
  discountPercent: number;
};

type ManualCharge = { title?: string; amount: number | string | { toString(): string } };

type HistoricalHourEntry = { serviceDateId: string; date: string; cups: number; exactServiceHours: number; extraServingHours: number; rate: number; fee: number };

export function getQuotationServiceHours(date: QuotationDocumentInput["serviceDates"][number]): number {
  if (date.durationMode) return date.durationMode === "FULL_DAY" ? 8 : 4;
  if (!date.startTime || !date.endTime) return 4;
  const minutes = (value: string) => { const [hours, mins] = value.split(":").map(Number); return hours * 60 + mins; };
  return Math.max(0.25, (minutes(date.endTime) - minutes(date.startTime)) / 60);
}

/** Inputs for the existing package engine; discounts and manual charges are applied separately. */
export function getQuotationPackageInput(data: QuotationDocumentInput): PricingInput | null {
  const legacyLevels: Record<string, PackageCode> = { LOW_SPEC: "CONFERENCE", MIDDLE_SPEC: "EXHIBITOR", HIGH_SPEC: "BRAND_LAUNCH", CUSTOMIZED: "CUSTOMIZE" };
  const level = data.packageSnapshot?.level ?? "";
  const code = data.packageCode ?? data.packageSnapshot?.packageCode ?? legacyLevels[level] ?? level;
  if (!PACKAGE_CODES.includes(code as PackageCode)) return null;
  return {
    packageCode: code as PackageCode,
    totalCups: data.totalCups ?? data.serviceDates.reduce((sum, date) => sum + date.cups, 0),
    selectedDates: data.serviceDates.map((date) => date.serviceDate ?? date.id).sort(),
    serviceDuration: data.serviceDuration ?? (data.serviceDates.some((date) => getQuotationServiceHours(date) > 4) ? "FULL_DAY" : "HALF_DAY"),
    packageFeatures: data.packageSnapshot?.perks?.map((perk) => perk.name),
    cartStyle: data.cartStyle,
    selectedOptions: data.selectedOptions ?? [],
    discountPercent: 0
  };
}

/**
 * Saved package price already includes its manpower, features and logistics.
 * Never subtract an inferred legacy fee or charge those inclusions a second time.
 */
export function calculateQuotationDocumentPricing(data: QuotationDocumentInput, extraCharges: ManualCharge[] = []) {
  const totalCups = data.totalCups ?? data.serviceDates.reduce((sum, date) => sum + date.cups, 0);
  const manpower = getQuotationBaristaPricing(totalCups, data.serviceDuration ?? "HALF_DAY",
    data.serviceDates.map((date) => date.serviceDate ?? date.id),
    data.serviceDuration ? {} : Object.fromEntries(data.serviceDates.map((date) => [date.serviceDate ?? date.id, getQuotationServiceHours(date) > 4 ? "FULL_DAY" : "HALF_DAY"])));
  const manualExtraChargeTotal = extraCharges
    .filter((charge) => String(charge.title ?? "").trim().toLowerCase() !== "extra serving hour")
    .reduce((sum, charge) => sum + Number(charge.amount), 0);
  const packageInput = getQuotationPackageInput(data);
  let packageAmount: number;
  if (data.packageSnapshot && Number.isFinite(Number(data.packageSnapshot.price))) {
    packageAmount = Number(data.packageSnapshot.price);
  } else if (packageInput) {
    packageAmount = calculateQuotationPricing(packageInput).subtotal;
  } else {
    // Historical records remain readable using saved amounts, never obsolete rate formulas.
    packageAmount = Number(data.pricingSnapshot?.packageAmount ?? Math.max(0, Number(data.pricingSnapshot?.subtotal ?? 0) - manualExtraChargeTotal));
  }
  const subtotal = packageAmount + manualExtraChargeTotal;
  const discountAmount = subtotal * ((data.discountPercent || 0) / 100);
  return {
    ...manpower,
    totalCups,
    packageAmount,
    baseAmount: packageAmount,
    manualExtraChargeTotal,
    subtotal,
    discountAmount,
    total: subtotal - discountAmount,
    // Compatibility fields for existing stored quotation payloads, not pricing inputs.
    fullDayBaristaFeesByDate: [] as Array<{ serviceDateId: string; date: string; cups: number; baristas: number; fee: number }>,
    machineRentalFee: 0,
    addonTotal: 0,
    cupSleeveFee: 0,
    cupStickerFee: 0,
    extraServingHoursByDate: [] as HistoricalHourEntry[],
    extraServingHourRate: 0,
    extraServingHourFeeByDate: [] as HistoricalHourEntry[],
    totalExtraServingHourFee: 0
  };
}
