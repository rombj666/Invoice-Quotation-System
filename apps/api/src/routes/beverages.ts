import { Prisma } from "@prisma/client";
import { Router } from "express";
import { cloudinaryFolders, deleteCloudinaryImage, uploadCloudinaryBuffer } from "../services/cloudinary.service";
import { parseMultipartRequest } from "../utils/multipart";
import { prisma } from "../utils/prisma";

export const beverageRoutes = Router();
export const adminBeverageRoutes = Router();

export function serializeBeverage(beverage: any) {
  return {
    id: beverage.id,
    name: beverage.name,
    description: beverage.description ?? undefined,
    imageUrl: beverage.imageUrl ?? undefined,
    publicId: beverage.publicId ?? undefined,
    icedAvailable: beverage.icedAvailable,
    hotAvailable: beverage.hotAvailable,
    isAvailable: beverage.isAvailable,
    isArchived: beverage.isArchived,
    displayOrder: beverage.displayOrder,
    createdAt: beverage.createdAt,
    updatedAt: beverage.updatedAt
  };
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

async function parseBeverageRequest(req: any) {
  if (!req.headers["content-type"]?.includes("multipart/form-data")) return { data: req.body, image: undefined };
  const multipart = await parseMultipartRequest(req, 8 * 1024 * 1024);
  return {
    data: JSON.parse(multipart.fields.payload ?? "{}"),
    image: multipart.files.find((file) => file.fieldName === "image")
  };
}

function validateInput(value: any, current?: any): { data?: Prisma.BeverageUncheckedCreateInput; error?: string } {
  const name = String(value?.name ?? current?.name ?? "").trim();
  if (!name) return { error: "Beverage name is required." };
  const icedAvailable = boolean(value?.icedAvailable, current?.icedAvailable ?? true);
  const hotAvailable = boolean(value?.hotAvailable, current?.hotAvailable ?? true);
  if (!icedAvailable && !hotAvailable) return { error: "A beverage must be available iced, hot, or both." };
  const displayOrder = Number(value?.displayOrder ?? current?.displayOrder ?? 0);
  if (!Number.isInteger(displayOrder) || displayOrder < 0) return { error: "Display order must be a non-negative whole number." };
  return { data: {
    id: current?.id ?? "",
    name,
    description: String(value?.description ?? current?.description ?? "").trim() || null,
    icedAvailable,
    hotAvailable,
    isAvailable: boolean(value?.isAvailable, current?.isAvailable ?? true),
    isArchived: boolean(value?.isArchived, current?.isArchived ?? false),
    displayOrder,
    imageUrl: current?.imageUrl ?? null,
    publicId: current?.publicId ?? null
  } };
}

beverageRoutes.get("/", async (_req, res, next) => {
  try {
    const beverages = await prisma.beverage.findMany({
      where: { isAvailable: true, isArchived: false },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
    });
    res.json(beverages.map(serializeBeverage));
  } catch (error) { next(error); }
});

adminBeverageRoutes.get("/", async (_req, res, next) => {
  try {
    const beverages = await prisma.beverage.findMany({ orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
    res.json(beverages.map(serializeBeverage));
  } catch (error) { next(error); }
});

adminBeverageRoutes.post("/", async (req, res, next) => {
  let uploadedPublicId: string | undefined;
  try {
    const { data: input, image } = await parseBeverageRequest(req);
    const validated = validateInput(input);
    if (validated.error || !validated.data) return res.status(400).json({ error: validated.error });
    const duplicate = await prisma.beverage.findFirst({ where: { name: { equals: validated.data.name, mode: "insensitive" } } });
    if (duplicate) return res.status(409).json({ error: "A beverage with this name already exists." });
    if (image && !image.mimeType.startsWith("image/")) return res.status(400).json({ error: "Beverage image must be an image file." });
    const upload = image ? await uploadCloudinaryBuffer(image, cloudinaryFolders.beverages, `${Date.now()}-${image.fileName}`) : null;
    uploadedPublicId = upload?.cloudinaryPublicId;
    const { id: _id, ...createData } = validated.data;
    const beverage = await prisma.beverage.create({ data: { ...createData, imageUrl: upload?.fileUrl ?? null, publicId: upload?.cloudinaryPublicId ?? null } });
    uploadedPublicId = undefined;
    res.status(201).json(serializeBeverage(beverage));
  } catch (error) {
    if (uploadedPublicId) await deleteCloudinaryImage(uploadedPublicId).catch(() => undefined);
    next(error);
  }
});

adminBeverageRoutes.patch("/:id", async (req, res, next) => {
  let uploadedPublicId: string | undefined;
  try {
    const current = await prisma.beverage.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Beverage not found." });
    const { data: input, image } = await parseBeverageRequest(req);
    const validated = validateInput(input, current);
    if (validated.error || !validated.data) return res.status(400).json({ error: validated.error });
    const duplicate = await prisma.beverage.findFirst({ where: { id: { not: current.id }, name: { equals: validated.data.name, mode: "insensitive" } } });
    if (duplicate) return res.status(409).json({ error: "A beverage with this name already exists." });
    if (image && !image.mimeType.startsWith("image/")) return res.status(400).json({ error: "Beverage image must be an image file." });
    const upload = image ? await uploadCloudinaryBuffer(image, cloudinaryFolders.beverages, `${current.id}-${Date.now()}-${image.fileName}`) : null;
    uploadedPublicId = upload?.cloudinaryPublicId;
    const { id: _id, ...updateData } = validated.data;
    const beverage = await prisma.beverage.update({ where: { id: current.id }, data: {
      ...updateData,
      ...(upload ? { imageUrl: upload.fileUrl, publicId: upload.cloudinaryPublicId } : {})
    } });
    uploadedPublicId = undefined;
    if (upload && current.publicId) void deleteCloudinaryImage(current.publicId).catch((error) => console.error("Unable to remove replaced beverage image.", { beverageId: current.id, publicId: current.publicId, error }));
    res.json(serializeBeverage(beverage));
  } catch (error) {
    if (uploadedPublicId) await deleteCloudinaryImage(uploadedPublicId).catch(() => undefined);
    next(error);
  }
});

adminBeverageRoutes.delete("/:id/image", async (req, res, next) => {
  try {
    const current = await prisma.beverage.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Beverage not found." });
    const beverage = await prisma.beverage.update({ where: { id: current.id }, data: { imageUrl: null, publicId: null } });
    if (current.publicId) void deleteCloudinaryImage(current.publicId).catch((error) => console.error("Unable to remove beverage image.", { beverageId: current.id, publicId: current.publicId, error }));
    res.json(serializeBeverage(beverage));
  } catch (error) { next(error); }
});

adminBeverageRoutes.delete("/:id", async (req, res, next) => {
  try {
    const current = await prisma.beverage.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Beverage not found." });
    const [quotationReferences, invoiceReferences] = await Promise.all([
      prisma.quotationDrink.count({ where: { beverageId: current.id } }),
      prisma.invoiceDrinkSnapshot.count({ where: { beverageId: current.id } })
    ]);
    if (quotationReferences + invoiceReferences > 0) {
      const archived = await prisma.beverage.update({ where: { id: current.id }, data: { isArchived: true, isAvailable: false } });
      return res.status(409).json({ error: "This beverage is referenced by historical documents and was archived instead.", beverage: serializeBeverage(archived) });
    }
    await prisma.beverage.delete({ where: { id: current.id } });
    if (current.publicId) void deleteCloudinaryImage(current.publicId).catch((error) => console.error("Unable to clean up deleted beverage image.", { beverageId: current.id, publicId: current.publicId, error }));
    res.status(204).send();
  } catch (error) { next(error); }
});
