import type { FixedPackageDisplay, PackageCode } from "../types/quotation";
import { apiBaseUrl } from "./api-client";

export type PackageInput = {
  name: string;
  shortDescription: string;
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

export function loadQuotationPackages(): Promise<FixedPackageDisplay[]> {
  return request<FixedPackageDisplay[]>("/api/packages");
}

export function loadAdminPackages(): Promise<FixedPackageDisplay[]> {
  return request<FixedPackageDisplay[]>("/api/admin/packages");
}

export function updatePackage(code: PackageCode, data: PackageInput): Promise<FixedPackageDisplay> {
  return request<FixedPackageDisplay>(`/api/admin/packages/${encodeURIComponent(code)}`, { method: "PUT", body: JSON.stringify(data) });
}
