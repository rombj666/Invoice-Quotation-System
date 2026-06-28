export type PricingInput = Record<string, never>;
export type PricingResult = Record<string, never>;

export function calculateQuotationPricing(_input: PricingInput): PricingResult {
  throw new Error("Pricing formulas will be implemented in Phase 4.");
}
