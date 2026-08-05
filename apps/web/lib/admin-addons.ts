import type { QuotationData } from "../types/quotation";

export type AdminAddonRow = {
  name: string;
  price: number;
};

const designOptionByAddon = {
  "Custom Branded Cart": "cart",
  "Custom Cup Stickers": "sticker",
  "Custom Cup Sleeves": "sleeve"
} as const;

function withSavedDesignCount(name: string, quotation: QuotationData): string {
  const optionKey = designOptionByAddon[name as keyof typeof designOptionByAddon];
  if (!optionKey) return name;
  const count = Number(quotation.customizationOptions?.[optionKey]?.designCount);
  if (!Number.isInteger(count) || count < 1) return name;
  return `${name} (${count} ${count === 1 ? "design" : "designs"})`;
}

export function getAdminAddonRows(
  quotation: QuotationData,
  cupStickerPrice: number,
  cupSleevePrice: number
): AdminAddonRow[] {
  const rows = quotation.selectedAddons.map((addon) => ({
    name: withSavedDesignCount(addon.name, quotation),
    price: Number(addon.price) || 0
  }));
  const selectedNames = new Set(quotation.selectedAddons.map((addon) => addon.name));

  if (quotation.hasCupStickers && !selectedNames.has("Custom Cup Stickers")) {
    rows.push({ name: withSavedDesignCount("Custom Cup Stickers", quotation), price: cupStickerPrice });
  }
  if (quotation.hasCupSleeves && !selectedNames.has("Custom Cup Sleeves")) {
    rows.push({ name: withSavedDesignCount("Custom Cup Sleeves", quotation), price: cupSleevePrice });
  }

  return rows;
}
