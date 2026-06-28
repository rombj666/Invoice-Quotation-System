import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const cloudinaryFolders = {
  receipts: "hour-coffee/receipts",
  invoices: "hour-coffee/invoices",
  cartDesigns: "hour-coffee/cart-designs",
  cupStickers: "hour-coffee/cup-stickers",
  cupSleeves: "hour-coffee/cup-sleeves"
} as const;

export { cloudinary };
