import { v2 as cloudinary } from "cloudinary";
import type { MultipartFile } from "../utils/multipart";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

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

function safePublicId(fileName: string, preserveExtension: boolean): string {
  const normalized = fileName.replace(/[^a-zA-Z0-9-_.]/g, "-");
  return preserveExtension ? normalized : normalized.replace(/\.[^.]+$/, "");
}

export async function uploadCloudinaryDataUrl(dataUrl: string | undefined, folder: string, fileName: string): Promise<CloudinaryUpload | null> {
  if (!dataUrl) return null;
  const mimeType = dataUrl.slice(5, dataUrl.indexOf(";")) || "application/octet-stream";
  const isPdf = mimeType === "application/pdf";
  const result = await cloudinary.uploader.upload(dataUrl, {
    folder,
    resource_type: isPdf ? "raw" : "auto",
    public_id: safePublicId(fileName, isPdf)
  });
  return { fileUrl: result.secure_url, cloudinaryPublicId: result.public_id, mimeType };
}

export function uploadCloudinaryBuffer(file: MultipartFile | undefined, folder: string, fileName: string): Promise<CloudinaryUpload | null> {
  if (!file) return Promise.resolve(null);
  const isPdf = file.mimeType === "application/pdf";
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: isPdf ? "raw" : "auto",
        public_id: safePublicId(fileName, isPdf)
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error("Unable to upload file."));
        resolve({ fileUrl: result.secure_url, cloudinaryPublicId: result.public_id, mimeType: file.mimeType });
      }
    );
    stream.end(file.buffer);
  });
}

export async function deleteCloudinaryPdf(publicId: string | null | undefined): Promise<void> {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw", invalidate: true });
}

export async function deleteCloudinaryImage(publicId: string | null | undefined): Promise<void> {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
}

export { cloudinary };
