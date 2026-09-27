// Payment account whitelist used by receipt auto-verification.
// Configure via PAYMENT_ACCOUNT_WHITELIST (comma-separated account numbers /
// e-wallet IDs) in the API .env, e.g.
//   PAYMENT_ACCOUNT_WHITELIST=1234567890,9876543210
// When unset the list is empty and every receipt falls back to manual review
// (fail-closed: no account is considered pre-approved).
export const PAYMENT_ACCOUNT_WHITELIST: string[] = (process.env.PAYMENT_ACCOUNT_WHITELIST ?? "")
  .split(",")
  .map((account) => account.trim())
  .filter(Boolean);
