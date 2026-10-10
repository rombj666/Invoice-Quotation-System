import type { MultipartFile } from "../utils/multipart";

export const cloudinaryFolders = {
  receipts: "hour-coffee/receipts",
  invoices: "hour-coffee/invoices",
  quotationPdfs: "hour-coffee/quotation-pdfs",
  invoicePdfs: "hour-coffee/invoice-pdfs",
  beverages: "hour-coffee/beverages",
  cartDesigns: "hour-coffee/cart-designs",
  cupStickers: "hour-coffee/cup-stickers",
  cupSleeves: "hour-coffee/cup-sleeves"
} as const;

export type CloudinaryUpload = {
  fileUrl: string;
  cloudinaryPublicId: string;
  mimeType: string;
};

type CloudinaryResource = "image" | "raw";

function cloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error("Cloudinary is not configured.");
  return { cloudName, apiKey, apiSecret };
}

function safePublicId(fileName: string, preserveExtension: boolean): string {
  const normalized = fileName.replace(/[^a-zA-Z0-9-_.]/g, "-");
  return preserveExtension ? normalized : normalized.replace(/\.[^.]+$/, "");
}

async function signature(parameters: Record<string, string>, apiSecret: string): Promise<string> {
  const canonical = Object.entries(parameters)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&") + apiSecret;
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function upload(file: Blob, mimeType: string, folder: string, fileName: string): Promise<CloudinaryUpload> {
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const resourceType: CloudinaryResource = mimeType === "application/pdf" ? "raw" : "image";
  const publicId = safePublicId(fileName, resourceType === "raw");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const parameters = { folder, public_id: publicId, timestamp };
  const form = new FormData();
  form.set("file", file, fileName);
  form.set("api_key", apiKey);
  form.set("timestamp", timestamp);
  form.set("folder", folder);
  form.set("public_id", publicId);
  form.set("signature", await signature(parameters, apiSecret));

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/upload`, {
    method: "POST",
    body: form
  });
  const result = await response.json() as { secure_url?: string; public_id?: string; error?: { message?: string } };
  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(result.error?.message ?? "Unable to upload file to Cloudinary.");
  }
  return { fileUrl: result.secure_url, cloudinaryPublicId: result.public_id, mimeType };
}

export async function uploadCloudinaryDataUrl(dataUrl: string | undefined, folder: string, fileName: string): Promise<CloudinaryUpload | null> {
  if (!dataUrl) return null;
  const match = /^data:([^;,]+)?(?:;[^,]*)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid data URL.");
  const mimeType = match[1] || "application/octet-stream";
  const payload = match[2];
  const bytes = dataUrl.includes(";base64,")
    ? Uint8Array.from(atob(payload), (character) => character.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(payload));
  return upload(new Blob([bytes], { type: mimeType }), mimeType, folder, fileName);
}

export function uploadCloudinaryBuffer(file: MultipartFile | undefined, folder: string, fileName: string): Promise<CloudinaryUpload | null> {
  if (!file) return Promise.resolve(null);
  return upload(new Blob([Uint8Array.from(file.buffer)], { type: file.mimeType }), file.mimeType, folder, fileName);
}

async function destroyCloudinaryAsset(publicId: string | null | undefined, resourceType: CloudinaryResource): Promise<void> {
  if (!publicId) return;
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const parameters = { public_id: publicId, timestamp, invalidate: "true" };
  const form = new FormData();
  form.set("public_id", publicId);
  form.set("timestamp", timestamp);
  form.set("invalidate", "true");
  form.set("api_key", apiKey);
  form.set("signature", await signature(parameters, apiSecret));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${resourceType}/destroy`, { method: "POST", body: form });
  if (!response.ok) throw new Error("Unable to delete Cloudinary asset.");
}

export function deleteCloudinaryPdf(publicId: string | null | undefined): Promise<void> {
  return destroyCloudinaryAsset(publicId, "raw");
}

export function deleteCloudinaryImage(publicId: string | null | undefined): Promise<void> {
  return destroyCloudinaryAsset(publicId, "image");
}
