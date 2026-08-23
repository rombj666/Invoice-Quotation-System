import type { PackageLevel, QuotationPackage } from "../types/quotation";
import { apiBaseUrl } from "./api-client";

export type PackageInput = {
  name: string;
  level: PackageLevel;
  briefDescription?: string;
  price: number;
  perks: string[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? "Unable to complete the package request.");
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function loadQuotationPackages(): Promise<QuotationPackage[]> {
  return request<QuotationPackage[]>("/api/packages");
}

export function loadAdminPackages(): Promise<QuotationPackage[]> {
  return request<QuotationPackage[]>("/api/admin/packages");
}

export function createPackage(data: PackageInput): Promise<QuotationPackage> {
  return request<QuotationPackage>("/api/admin/packages", { method: "POST", body: JSON.stringify(data) });
}

export function updatePackage(id: string, data: PackageInput): Promise<QuotationPackage> {
  return request<QuotationPackage>(`/api/admin/packages/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deletePackage(id: string): Promise<void> {
  return request<void>(`/api/admin/packages/${encodeURIComponent(id)}`, { method: "DELETE" });
}
