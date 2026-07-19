export function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getMinimumSelectableDate(now = new Date()): Date {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const minimumSelectableDate = new Date(today);
  minimumSelectableDate.setDate(minimumSelectableDate.getDate() + 6);
  return minimumSelectableDate;
}
