import { apiBaseUrl } from "./api-client";

export type AvailabilityItem = {
  id: string;
  category: string;
  itemKey: string;
  itemName: string;
  isAvailable: boolean;
};

export type AvailabilityGroups = Record<string, AvailabilityItem[]>;

export const beverageAvailabilityKeys = {
  americano: "americano",
  latte: "cafe_latte",
  chocolate: "dark_chocolate",
  lemonade: "lemonade"
} as const;

export const addonAvailabilityKeys: Record<string, string> = {
  "Smart QR Ordering System": "smart_qr_ordering_system",
  "Premium Table Setup": "premium_table_setup",
  "Coffee Cart": "coffee_cart",
  "Custom Branded Cart": "custom_branded_cart",
  "Custom Cup Stickers": "custom_cup_stickers",
  "Custom Cup Sleeves": "custom_cup_sleeves",
  "Custom Menu": "custom_menu",
  "Custom Latte Art Stencil": "custom_latte_art_stencil"
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  if (!response.ok) throw new Error("Product availability request failed.");
  return response.json() as Promise<T>;
}

export function loadProductAvailability(): Promise<AvailabilityGroups> {
  return request<AvailabilityGroups>("/api/admin/product-availability");
}

export function updateProductAvailability(itemKey: string, isAvailable: boolean): Promise<AvailabilityItem> {
  return request<AvailabilityItem>(`/api/admin/product-availability/${encodeURIComponent(itemKey)}`, {
    method: "PATCH",
    body: JSON.stringify({ isAvailable })
  });
}

export function flattenAvailability(groups: AvailabilityGroups): Record<string, AvailabilityItem> {
  return Object.values(groups).flat().reduce<Record<string, AvailabilityItem>>((items, item) => {
    items[item.itemKey] = item;
    return items;
  }, {});
}
