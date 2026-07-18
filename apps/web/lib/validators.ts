export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidMalaysiaPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  const local = digits.startsWith("60") ? `0${digits.slice(2)}` : digits;
  return /^01\d{8,9}$/.test(local);
}

export function hasText(value: string): boolean {
  return value.trim().length > 0;
}
