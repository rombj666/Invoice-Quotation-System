export const PACKAGE_CODES = ["CONFERENCE", "EXHIBITOR", "BRAND_LAUNCH", "CUSTOMIZE"] as const;
export type PackageCode = (typeof PACKAGE_CODES)[number];

export const CART_STYLES = ["NO_CART", "EQUIPMENT_CART", "FOAM_BOARD_DISPLAY_CART"] as const;
export type CartStyle = (typeof CART_STYLES)[number];

export const PACKAGE_OPTION_CODES = ["CUP_SLEEVES", "LATTE_ART", "FOAM_BOARD_STAND", "CUSTOM_SYRUP"] as const;
export type PackageOptionCode = (typeof PACKAGE_OPTION_CODES)[number];

export type PackageRule = {
  code: PackageCode;
  name: string;
  shortDescription: string;
  perDayMoq: number;
  sleevesIncluded: boolean;
  cartSelectionRequired: boolean;
  defaultCart?: CartStyle;
  availableCartStyles: CartStyle[];
  availableOptions: PackageOptionCode[];
  includedItems: string[];
};

const STANDARD_INCLUDED = [
  "Coffee Catering",
  "Standard Tabletop Setup",
  "Required Barista Team",
  "Setup + Logistics"
];

export const PACKAGE_RULES: Record<PackageCode, PackageRule> = {
  CONFERENCE: {
    code: "CONFERENCE",
    name: "Conference",
    shortDescription: "Simple and efficient service for meetings and conferences.",
    perDayMoq: 50,
    sleevesIncluded: true,
    cartSelectionRequired: false,
    availableCartStyles: [],
    availableOptions: [],
    includedItems: ["Coffee Catering", "Standard Tabletop Setup", "Standard Cup Sleeves", "Required Barista Team", "Setup + Logistics"]
  },
  EXHIBITOR: {
    code: "EXHIBITOR",
    name: "Exhibitor",
    shortDescription: "Designed for exhibitions, booths and busy visitor moments.",
    perDayMoq: 150,
    sleevesIncluded: true,
    cartSelectionRequired: false,
    availableCartStyles: [],
    availableOptions: ["LATTE_ART"],
    includedItems: ["Coffee Catering", "Standard Tabletop Setup", "Standard Cup Sleeves", "Required Barista Team", "Setup + Logistics"]
  },
  BRAND_LAUNCH: {
    code: "BRAND_LAUNCH",
    name: "Brand Launch",
    shortDescription: "A premium branded service experience for high-impact events.",
    perDayMoq: 200,
    sleevesIncluded: true,
    cartSelectionRequired: false,
    availableCartStyles: [],
    availableOptions: [],
    includedItems: [
      "Coffee Catering",
      "Equipment Cart",
      "Standard Cup Sleeves",
      "Required Barista Team",
      "Setup + Logistics",
      "Foam Board Display Cart",
      "Foam Board Stand",
      "Customizable Syrup Drink"
    ]
  },
  CUSTOMIZE: {
    code: "CUSTOMIZE",
    name: "Customize",
    shortDescription: "Build the service around your event using approved options.",
    perDayMoq: 50,
    sleevesIncluded: false,
    cartSelectionRequired: true,
    availableCartStyles: ["NO_CART", "EQUIPMENT_CART", "FOAM_BOARD_DISPLAY_CART"],
    availableOptions: ["CUP_SLEEVES", "LATTE_ART", "FOAM_BOARD_STAND", "CUSTOM_SYRUP"],
    includedItems: STANDARD_INCLUDED
  }
};

export const PACKAGE_OPTION_LABELS: Record<PackageOptionCode, string> = {
  CUP_SLEEVES: "Standard Cup Sleeves",
  LATTE_ART: "Special Print Latte Art",
  FOAM_BOARD_STAND: "Foam Board Stand",
  CUSTOM_SYRUP: "Customizable Syrup Drink"
};

export const CART_STYLE_LABELS: Record<CartStyle, string> = {
  NO_CART: "No Cart",
  EQUIPMENT_CART: "Equipment Cart",
  FOAM_BOARD_DISPLAY_CART: "Foam Board Display Cart"
};

export type PricingInput = {
  totalCups: number;
  selectedDates: string[];
  packageCode: PackageCode;
  packageFeatures?: string[];
  extendToEightHours?: boolean;
  cartStyle?: CartStyle;
  selectedOptions?: PackageOptionCode[];
  discountPercent?: number;
};

export type PricingResult = {
  packageCode: PackageCode;
  packageName: string;
  totalCups: number;
  selectedDates: string[];
  serviceDayCount: number;
  averageCupsPerDay: number;
  baristasPerDay: number;
  standardServiceHours: 4 | 8;
  extendedToEightHours: boolean;
  cartStyle?: CartStyle;
  selectedOptions: PackageOptionCode[];
  cupRate: number;
  cupRevenue: number;
  sleeveCharge: number;
  selectionCharge: number;
  extensionLabor: number;
  preTravelSubtotal: number;
  travel: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  finalTotal: number;
};

export type PricingValidation = {
  valid: boolean;
  validationMessages: string[];
  normalizedInput?: PricingInput;
};

export const CUP_TIERS = [
  { minimumCups: 400, rate: 7.5 },
  { minimumCups: 300, rate: 8 },
  { minimumCups: 200, rate: 8.5 },
  { minimumCups: 100, rate: 9 },
  { minimumCups: 50, rate: 10 }
] as const;

export const SLEEVE_RATE = 0.5;
export const SLEEVE_MIN_QTY = 200;
export const TRAVEL_THRESHOLD = 1500;
export const TRAVEL_LOW = 150;
export const TRAVEL_HIGH = 250;
export const FEATURE_PRICES = {
  "special print latte art": 200,
  "foam board display cart": 100,
  "foam board stand": 80,
  "customizable syrup drink": 100
} as const;

function isPackageCode(value: unknown): value is PackageCode {
  return PACKAGE_CODES.includes(value as PackageCode);
}

function isCartStyle(value: unknown): value is CartStyle {
  return CART_STYLES.includes(value as CartStyle);
}

function isPackageOption(value: unknown): value is PackageOptionCode {
  return PACKAGE_OPTION_CODES.includes(value as PackageOptionCode);
}

export function getCupRate(totalCups: number): number {
  return CUP_TIERS.find((tier) => totalCups >= tier.minimumCups)?.rate ?? 10;
}

export function getAverageCupsPerDay(totalCups: number, serviceDayCount: number): number {
  return serviceDayCount > 0 ? totalCups / serviceDayCount : 0;
}

export function getBaristasPerDay(averageCupsPerDay: number): 1 | 2 {
  return averageCupsPerDay <= 100 ? 1 : 2;
}

export function getStandardServiceHours(averageCupsPerDay: number): 4 | 8 {
  return averageCupsPerDay < 200 ? 4 : 8;
}

export function calculateSleeveCharge(totalCups: number): number {
  return Math.max(totalCups, SLEEVE_MIN_QTY) * SLEEVE_RATE;
}

export function calculateTravel(preTravelSubtotal: number): number {
  return preTravelSubtotal <= TRAVEL_THRESHOLD ? TRAVEL_LOW : TRAVEL_HIGH;
}

export function validatePricingInput(input: PricingInput): PricingValidation {
  const messages: string[] = [];
  if (!Number.isInteger(input.totalCups) || input.totalCups < 50) messages.push("Minimum order is 50 cups.");
  if (!Array.isArray(input.selectedDates) || input.selectedDates.length === 0) messages.push("Choose at least one event date.");
  const selectedDates = [...new Set((input.selectedDates ?? []).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
  if (selectedDates.length !== (input.selectedDates ?? []).length) messages.push("Event dates must be valid and cannot be duplicated.");
  if (!isPackageCode(input.packageCode)) messages.push("Choose a valid package.");
  if (messages.length || !isPackageCode(input.packageCode)) return { valid: false, validationMessages: messages };

  const rule = PACKAGE_RULES[input.packageCode];
  const requestedOptions = Array.isArray(input.selectedOptions) ? input.selectedOptions : [];
  const selectedOptions = [...new Set(requestedOptions.filter(isPackageOption))];
  if (selectedOptions.length !== requestedOptions.length || selectedOptions.some((option) => !rule.availableOptions.includes(option))) {
    messages.push("One or more selected options are not available for this package.");
  }

  let cartStyle = input.cartStyle;
  if (rule.cartSelectionRequired && !isCartStyle(cartStyle)) messages.push("Choose one cart style for Customize.");
  if (cartStyle && (!isCartStyle(cartStyle) || !rule.availableCartStyles.includes(cartStyle))) messages.push("The selected cart style is not available for this package.");

  const discountPercent = Number(input.discountPercent ?? 0);
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) messages.push("The discount is invalid.");

  return {
    valid: messages.length === 0,
    validationMessages: messages,
    ...(messages.length === 0 ? { normalizedInput: {
      totalCups: input.totalCups,
      selectedDates,
      packageCode: input.packageCode,
      packageFeatures: Array.isArray(input.packageFeatures) ? input.packageFeatures.map(String) : undefined,
      extendToEightHours: Boolean(input.extendToEightHours),
      ...(cartStyle ? { cartStyle } : {}),
      selectedOptions,
      discountPercent
    } } : {})
  };
}

function normalizeFeatureName(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  return normalized === "custom syrup drink" ? "customizable syrup drink" : normalized;
}

/**
 * FINAL APPROVED QUOTATION PRICING RULES.
 * Do not change these rules as part of unrelated quotation, package, or UI work.
 */
export function calculateQuotationPricing(input: PricingInput): PricingResult {
  const validation = validatePricingInput(input);
  if (!validation.valid || !validation.normalizedInput) throw new Error(validation.validationMessages[0] ?? "Invalid quotation pricing input.");

  const normalized = validation.normalizedInput;
  const rule = PACKAGE_RULES[normalized.packageCode];
  const serviceDayCount = normalized.selectedDates.length;
  const packageFeatures = normalized.packageFeatures ?? rule.includedItems;
  const selectedFeatureNames = [
    ...packageFeatures,
    ...(normalized.cartStyle ? [CART_STYLE_LABELS[normalized.cartStyle]] : []),
    ...(normalized.selectedOptions ?? []).map((option) => PACKAGE_OPTION_LABELS[option])
  ];
  const featureKeys = new Set(selectedFeatureNames.map(normalizeFeatureName));
  const cupRate = getCupRate(normalized.totalCups);
  const cupRevenue = normalized.totalCups * cupRate;
  const sleeveCharge = featureKeys.has("standard cup sleeves") ? calculateSleeveCharge(normalized.totalCups) : 0;
  const selectionCharge = [...featureKeys].reduce((total, feature) => total + (FEATURE_PRICES[feature as keyof typeof FEATURE_PRICES] ?? 0), 0);
  const extensionLabor = 0;
  const preTravelSubtotal = cupRevenue + sleeveCharge + selectionCharge;
  const travel = calculateTravel(preTravelSubtotal);
  const subtotal = preTravelSubtotal + travel;
  const discountPercent = normalized.discountPercent ?? 0;
  const discountAmount = subtotal * (discountPercent / 100);

  return {
    packageCode: normalized.packageCode,
    packageName: rule.name,
    totalCups: normalized.totalCups,
    selectedDates: normalized.selectedDates,
    serviceDayCount,
    // Legacy response fields remain for stored-payload compatibility; they do not drive pricing.
    averageCupsPerDay: 0,
    baristasPerDay: 1,
    standardServiceHours: 4,
    extendedToEightHours: false,
    ...(normalized.cartStyle ? { cartStyle: normalized.cartStyle } : {}),
    selectedOptions: normalized.selectedOptions ?? [],
    cupRate,
    cupRevenue,
    sleeveCharge,
    selectionCharge,
    extensionLabor,
    preTravelSubtotal,
    travel,
    subtotal,
    discountPercent,
    discountAmount,
    finalTotal: subtotal - discountAmount
  };
}
