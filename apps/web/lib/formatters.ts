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

export function formatTime(value: string): string {
  if (!value) return "-";
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteText} ${suffix}`;
}
