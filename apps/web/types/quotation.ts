export type DrinkId = string;

export type DrinkOption = {
  id: DrinkId;
  name: string;
  description?: string;
  imageUrl?: string;
  icedAvailable: boolean;
  hotAvailable: boolean;
};

export type ServiceDurationMode = "HALF_DAY" | "FULL_DAY";

export type ServiceDate = {
  id: string;
  serviceDate: string;
  cups: number;
  durationMode?: ServiceDurationMode;
  startTime: string;
  endTime: string;
};

export type DrinkQuantity = {
  ice: number;
  hot: number;
};

export type DrinkOrderByDate = Record<string, Record<DrinkId, DrinkQuantity>>;
export type DrinkDistributionMode = "MANUAL" | "HOUR_COFFEE_DECIDES";
export type DrinkDistributionModeByDate = Record<string, DrinkDistributionMode>;
export type ExcludedBeveragesByDate = Record<string, string[]>;

export type BeverageSnapshot = {
  id: string;
  name: string;
  imageUrl?: string;
  icedAvailable: boolean;
  hotAvailable: boolean;
};

export type QuotationAddon = {
  name: string;
  price: number;
  isIncluded?: boolean;
};

export type PackageLevel = "LOW_SPEC" | "MIDDLE_SPEC" | "HIGH_SPEC" | "CUSTOMIZED";
export type PackageCode = "CONFERENCE" | "EXHIBITOR" | "BRAND_LAUNCH" | "CUSTOMIZE";
export type CartStyle = "NO_CART" | "EQUIPMENT_CART" | "FOAM_BOARD_DISPLAY_CART";
export type PackageOptionCode = "CUP_SLEEVES" | "LATTE_ART" | "FOAM_BOARD_STAND" | "CUSTOM_SYRUP";

export type FixedPackageDisplay = {
  id: string;
  code: PackageCode;
  name: string;
  shortDescription: string;
  price: number;
  perDayMoq: number;
  includedItems: string[];
  availableOptions: Array<{ code: PackageOptionCode; label: string }>;
  availableCartStyles: Array<{ code: CartStyle; label: string }>;
  cartSelectionRequired: boolean;
  defaultCart?: CartStyle;
};

export type QuotationPricingPreview = {
  valid: boolean;
  validationMessages: string[];
  finalTotal: number;
  packageDisplay: FixedPackageDisplay;
  selectedItems: string[];
  averageCupsPerDay: number;
  baristasPerDay: number;
  requiredBaristas: number;
  extraBaristas: number;
  extraBaristaFee: number;
  standardServiceHours: 4 | 8;
  extendedToEightHours: boolean;
};

export type PackagePerk = {
  id: string;
  name: string;
  displayOrder: number;
};

export type QuotationPackage = {
  id: string;
  name: string;
  level: PackageLevel;
  briefDescription?: string;
  price: number;
  perks: PackagePerk[];
  createdAt?: string;
  updatedAt?: string;
};

export type QuotationPackageSnapshot = Omit<QuotationPackage, "createdAt" | "updatedAt">;

export type QuotationExtraCharge = {
  id: string;
  title: string;
  description?: string;
  amount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type CupStickerPricingConfig = {
  baseCupLimit: number;
  basePrice: number;
  additionalTierCups: number;
  additionalTierPrice: number;
};

export type CupSleevePricingConfig = {
  threshold: number;
  rateBelowThreshold: number;
  rateAtOrAboveThreshold: number;
};

export type AddonPricingSnapshot = {
  cupSticker: CupStickerPricingConfig;
  cupSleeve: CupSleevePricingConfig;
};

export type CustomizationMode = "same" | "per-date";

export type CustomizationOption = {
  mode: CustomizationMode;
  designCount: number;
};

export type CustomerDetails = {
  name: string;
  phone: string;
  email: string;
  companyName: string;
  companyRegNo: string;
  billingAddress: string;
};

export type QuotationData = {
  id?: string;
  quotationNo: string;
  anonymousSessionId?: string;
  status?:
    | "DRAFT"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REVIEWED"
    | "SENT"
    | "CONVERTED_TO_INVOICE"
    | "CANCELLED";
  createdAt?: string;
  quotationPdfUrl?: string;
  quotationPdfPublicId?: string;
  updatedAt?: string;
  hasInvoice?: boolean;
  editHistory?: Array<{ changedAt: string; changedBy: string; summary?: string }>;
  serviceDates: ServiceDate[];
  selectedPackageId?: string;
  packageCode?: PackageCode;
  selectedDates?: string[];
  extendToEightHours?: boolean;
  cartStyle?: CartStyle;
  selectedOptions?: PackageOptionCode[];
  packageSnapshot?: QuotationPackageSnapshot;
  notes?: string;
  totalCups?: number;
  serviceDuration?: ServiceDurationMode;
  location: string;
  fullAddress: string;
  eventType: string;
  customEventType: string;
  drinkOrders: DrinkOrderByDate;
  drinkDistributionModeByDate?: DrinkDistributionModeByDate;
  excludedBeverageIdsByDate?: ExcludedBeveragesByDate;
  beverageSnapshots?: Record<string, BeverageSnapshot>;
  sameDrinkDistribution: boolean;
  letHourCoffeeDecideDrinks?: boolean;
  masterDrinkDate?: string;
  selectedAddons: QuotationAddon[];
  extraCharges?: QuotationExtraCharge[];
  addonPricing?: AddonPricingSnapshot;
  hasCupSleeves: boolean;
  hasCupStickers: boolean;
  customizationOptions: {
    cart: CustomizationOption;
    sticker: CustomizationOption;
    sleeve: CustomizationOption;
  };
  customer: CustomerDetails;
  discountCode: string;
  discountPercent: number;
  linkExpiryDays: number;
  expiresAt?: string;
  pricingSnapshot?: {
    subtotal: number;
    discountAmount: number;
    total: number;
    cupRate?: number;
    cupRevenue?: number;
    sleeveCharge?: number;
    selectionCharge?: number;
    extensionLabor?: number;
    preTravelSubtotal?: number;
    travel?: number;
  };
  pricingBreakdown?: {
    requiredBaristas?: number;
    extraBaristas?: number;
    extraBaristaFee?: number;
    fullDayBaristaFeesByDate?: FullDayBaristaFeeBreakdown[];
    extraServingHoursByDate: ExtraServingHourBreakdown[];
    extraServingHourRate: number;
    extraServingHourFeeByDate: ExtraServingHourBreakdown[];
    totalExtraServingHourFee: number;
  };
};

export type FullDayBaristaFeeBreakdown = {
  serviceDateId: string;
  date: string;
  cups: number;
  baristas: number;
  fee: number;
};

export type ExtraServingHourBreakdown = {
  serviceDateId: string;
  date: string;
  cups: number;
  exactServiceHours: number;
  extraServingHours: number;
  rate: number;
  fee: number;
};

export type PreviousQuotationSummary = {
  quotationNo: string;
  createdAt: string;
  firstEventDate: string | null;
  status: string;
  hasInvoice: boolean;
  canViewQuotation: boolean;
};
