import { Router } from "express";
import { prisma } from "../utils/prisma";

export const adminProductAvailabilityRoutes = Router();

const defaultItems = [
  { category: "Beverages", itemKey: "americano", itemName: "Americano" },
  { category: "Beverages", itemKey: "cafe_latte", itemName: "Cafe Latte" },
  { category: "Beverages", itemKey: "dark_chocolate", itemName: "Dark Chocolate" },
  { category: "Beverages", itemKey: "lemonade", itemName: "Lemonade" },
  { category: "Add-on Features", itemKey: "smart_qr_ordering_system", itemName: "Smart QR Ordering System" },
  { category: "Add-on Features", itemKey: "premium_table_setup", itemName: "Premium Table Setup" },
  { category: "Add-on Features", itemKey: "coffee_cart", itemName: "Coffee Cart" },
  { category: "Add-on Features", itemKey: "custom_branded_cart", itemName: "Custom Branded Cart" },
  { category: "Add-on Features", itemKey: "custom_cup_stickers", itemName: "Custom Cup Stickers" },
  { category: "Add-on Features", itemKey: "custom_cup_sleeves", itemName: "Custom Cup Sleeves" },
  { category: "Add-on Features", itemKey: "custom_menu", itemName: "Custom Menu" },
  { category: "Add-on Features", itemKey: "custom_latte_art_stencil", itemName: "Custom Latte Art Stencil" }
] as const;

async function ensureDefaults() {
  await Promise.all(defaultItems.map((item) => prisma.productAvailability.upsert({
    where: { itemKey: item.itemKey },
    update: { category: item.category, itemName: item.itemName },
    create: { ...item, isAvailable: true }
  })));
}

function groupItems(items: Array<{ category: string; itemKey: string; itemName: string; isAvailable: boolean }>) {
  return items.reduce<Record<string, typeof items>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  }, {});
}

adminProductAvailabilityRoutes.get("/", async (_req, res, next) => {
  try {
    await ensureDefaults();
    const items = await prisma.productAvailability.findMany({ orderBy: [{ category: "asc" }, { itemName: "asc" }] });
    res.json(groupItems(items));
  } catch (error) {
    next(error);
  }
});

adminProductAvailabilityRoutes.patch("/:itemKey", async (req, res, next) => {
  try {
    await ensureDefaults();
    const item = await prisma.productAvailability.update({
      where: { itemKey: req.params.itemKey },
      data: { isAvailable: Boolean(req.body.isAvailable) }
    });
    res.json(item);
  } catch (error) {
    next(error);
  }
});
