export function formatMoney(amount: number): string {
  return `MYR ${amount.toFixed(2)}`;
}

export function formatDateLabel(value: string): string {
  if (!value) return "-";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function formatShortDate(value: string): string {
  if (!value) return "-";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short"
  });
}

export function formatCompactDate(value: string | Date): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  return `${day}/${month}/${date.getFullYear()}`;
}

export function formatTime(value: string): string {
  if (!value) return "-";
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteText} ${suffix}`;
}
