export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidMalaysiaPhone(value: string): boolean {
  return /^01\d{8,9}$/.test(value.replace(/\D/g, ""));
}

export function hasText(value: string): boolean {
  return value.trim().length > 0;
}
