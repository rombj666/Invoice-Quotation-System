import type { QuotationData } from "../types/quotation";

export type CustomerCustomizationStep = "details" | "cart" | "sleeve" | "sticker" | "menu" | "latte" | "finish";

const normalize = (value: string) => value.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");

export function getCustomerCustomizationSteps(quotation: QuotationData): CustomerCustomizationStep[] {
  const optionCodes = new Set(quotation.selectedOptions ?? []);
  const featureNames = new Set([
    ...(quotation.packageSnapshot?.perks.map((item) => item.name) ?? []),
    ...quotation.selectedAddons.map((item) => item.name)
  ].map(normalize));
  const includes = (...needles: string[]) => [...featureNames].some((feature) => needles.some((needle) => feature.includes(needle)));
  const steps: CustomerCustomizationStep[] = ["details"];
  if ((quotation.cartStyle && quotation.cartStyle !== "NO_CART") || includes("coffee cart", "branded cart", "display cart")) steps.push("cart");
  if (quotation.hasCupSleeves || optionCodes.has("CUP_SLEEVES") || includes("cup sleeve")) steps.push("sleeve");
  if (quotation.hasCupStickers || includes("cup sticker")) steps.push("sticker");
  if (includes("custom menu")) steps.push("menu");
  if (optionCodes.has("LATTE_ART") || includes("latte art", "print pen", "special print")) steps.push("latte");
  steps.push("finish");
  return steps;
}
