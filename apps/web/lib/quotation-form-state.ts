export const quotationDraftStorageKey = "hourCoffeeQuotationDraft";
export const submittedQuotationStorageKey = "hourCoffeeLastSubmittedQuotation";
export const quotationSuccessPath = "/quotation/submitted";

export function hasSubmittedQuotation(): boolean {
  const saved = window.localStorage.getItem(submittedQuotationStorageKey);
  if (!saved) return false;
  try {
    return JSON.parse(saved)?.status === "submitted";
  } catch {
    window.localStorage.removeItem(submittedQuotationStorageKey);
    return false;
  }
}

export function completeQuotationForm(quotationNo: string) {
  // Write the small success marker first so a pending autosave cannot recreate the draft.
  window.localStorage.setItem(submittedQuotationStorageKey, JSON.stringify({
    status: "submitted", quotationNo, submittedAt: new Date().toISOString()
  }));
  window.localStorage.removeItem(quotationDraftStorageKey);
}

export function clearQuotationForm() {
  window.localStorage.removeItem(quotationDraftStorageKey);
  window.localStorage.removeItem(submittedQuotationStorageKey);
}
