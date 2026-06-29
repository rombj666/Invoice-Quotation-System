export type DrinkId = "americano" | "latte" | "chocolate" | "lemonade";

export type DrinkOption = {
  id: DrinkId;
  name: string;
  hasHot: boolean;
};

export type ServiceDate = {
  id: string;
  serviceDate: string;
  cups: number;
  startTime: string;
  endTime: string;
};

export type DrinkQuantity = {
  ice: number;
  hot: number;
};

export type DrinkOrderByDate = Record<string, Record<DrinkId, DrinkQuantity>>;

export type QuotationAddon = {
  name: string;
  price: number;
  isIncluded?: boolean;
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
  quotationNo: string;
  status?: "PENDING_APPROVAL" | "APPROVED";
  serviceDates: ServiceDate[];
  location: string;
  fullAddress: string;
  eventType: string;
  customEventType: string;
  drinkOrders: DrinkOrderByDate;
  sameDrinkDistribution: boolean;
  letHourCoffeeDecideDrinks?: boolean;
  masterDrinkDate?: string;
  selectedAddons: QuotationAddon[];
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
  };
};
