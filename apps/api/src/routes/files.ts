import { Router } from "express";

export const fileRoutes = Router();

const allowedHosts = new Set(["res.cloudinary.com", "cloudinary.com"]);

function safeFileName(value: string | undefined, contentType: string): string {
  const fallbackExtension = contentType.includes("pdf")
    ? "pdf"
    : contentType.startsWith("image/")
      ? contentType.split("/")[1]?.split(";")[0] || "img"
      : "bin";
  const fallback = `hour-coffee-file.${fallbackExtension}`;
  const name = (value || fallback).replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, " ").trim();
  return name || fallback;
}

function validateDownloadUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    if (!allowedHosts.has(parsed.hostname.toLowerCase())) return null;
    return parsed;
  } catch {
    return null;
  }
}

fileRoutes.get("/download", async (req, res, next) => {
  try {
    const fileUrl = validateDownloadUrl(req.query.url);
    if (!fileUrl) return res.status(400).json({ error: "A valid Cloudinary file URL is required." });

    const response = await fetch(fileUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Unable to fetch file for download." });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = safeFileName(typeof req.query.filename === "string" ? req.query.filename : undefined, contentType);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});
