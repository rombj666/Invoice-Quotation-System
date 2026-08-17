import { apiBaseUrl } from "./api-client";
import type { QuotationData } from "../types/quotation";

export type Beverage = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  publicId?: string;
  icedAvailable: boolean;
  hotAvailable: boolean;
  isAvailable: boolean;
  isArchived: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers } });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error ?? "Beverage request failed.") as Error & { beverage?: Beverage };
    error.beverage = payload?.beverage;
    throw error;
  }
  return payload as T;
}

export const loadBeverages = () => request<Beverage[]>("/api/beverages");
export const loadAdminBeverages = () => request<Beverage[]>("/api/admin/beverages");

function beverageForm(data: Partial<Beverage>, image?: File) {
  const form = new FormData();
  form.append("payload", JSON.stringify(data));
  if (image) form.append("image", image, image.name);
  return form;
}

export const createBeverage = (data: Partial<Beverage>, image?: File) => request<Beverage>("/api/admin/beverages", { method: "POST", body: beverageForm(data, image) });
export const updateBeverage = (id: string, data: Partial<Beverage>, image?: File) => request<Beverage>(`/api/admin/beverages/${encodeURIComponent(id)}`, { method: "PATCH", body: beverageForm(data, image) });
export const removeBeverageImage = (id: string) => request<Beverage>(`/api/admin/beverages/${encodeURIComponent(id)}/image`, { method: "DELETE" });
export const deleteBeverage = (id: string) => request<void>(`/api/admin/beverages/${encodeURIComponent(id)}`, { method: "DELETE" });

export function getProvidedBeverageNames(data: QuotationData, dateId: string): string[] {
  const snapshots = data.beverageSnapshots ?? {};
  const excluded = new Set(data.excludedBeverageIdsByDate?.[dateId] ?? []);
  const mode = data.drinkDistributionModeByDate?.[dateId]
    ?? (data.letHourCoffeeDecideDrinks ? "HOUR_COFFEE_DECIDES" : "MANUAL");
  const historicalOrder = data.drinkOrders[dateId] ?? {};
  const manuallyProvidedIds = mode === "MANUAL"
    ? Object.entries(historicalOrder)
      .filter(([id, quantity]) => !excluded.has(id) && quantity.ice + quantity.hot > 0)
      .map(([id]) => id)
    : [];
  const providedIds = manuallyProvidedIds.length
    ? manuallyProvidedIds
    : Object.keys(snapshots).filter((id) => !excluded.has(id));

  return [...new Set(providedIds.map((id) => snapshots[id]?.name ?? id))];
}

export function getAllProvidedBeverageNames(data: QuotationData): string[] {
  return [...new Set(data.serviceDates.flatMap((date) => getProvidedBeverageNames(data, date.id)))];
}
