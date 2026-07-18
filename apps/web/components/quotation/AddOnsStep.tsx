"use client";

import { useEffect, useState } from "react";
import type { CustomizationOption, QuotationAddon, QuotationData } from "../../types/quotation";
import { formatMoney } from "../../lib/formatters";
import { addonAvailabilityKeys, flattenAvailability, loadProductAvailability, type AvailabilityItem } from "../../lib/product-availability";
import { getCupSleevePrice, getCupStickerPrice, getMachineRentalFee } from "../../lib/pricing";
import { StepNavigation } from "../common/StepNavigation";

type Props = {
  data: QuotationData;
  setData: (data: QuotationData) => void;
  onBack: () => void;
  onNext: () => void;
};

const optionalAddons: QuotationAddon[] = [
  { name: "Custom Branded Cart", price: 150 },
  { name: "Custom Menu", price: 30 },
  { name: "Custom Latte Art Stencil", price: 100 }
];

const leadTimeAddonNames = new Set(["Custom Branded Cart", "Custom Menu"]);
const coffeeCartAddon: QuotationAddon = { name: "Coffee Cart", price: 50 };

function hasAddon(data: QuotationData, name: string): boolean {
  return data.selectedAddons.some((addon) => addon.name === name);
}

function hasEnoughLeadTime(data: QuotationData): boolean {
  const earliestTime = data.serviceDates.reduce<number | null>((earliest, date) => {
    if (!date.serviceDate) return earliest;
    const time = new Date(`${date.serviceDate}T00:00:00`).getTime();
    return earliest === null ? time : Math.min(earliest, time);
  }, null);
  if (earliestTime === null) return true;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilEvent = Math.floor((earliestTime - today.getTime()) / (24 * 60 * 60 * 1000));
  return daysUntilEvent >= 14;
}

function normalizeDesignOption(option: CustomizationOption, selectedDateCount: number): CustomizationOption {
  if (selectedDateCount <= 1 || option.mode === "same") return { mode: "same", designCount: 1 };
  return { mode: "per-date", designCount: selectedDateCount };
}

function DesignOptions({
  label,
  option,
  selectedDateCount,
  onChange
}: {
  label: string;
  option: CustomizationOption;
  selectedDateCount: number;
  onChange: (option: CustomizationOption) => void;
}) {
  const showMode = selectedDateCount > 1;
  const normalized = normalizeDesignOption(option, selectedDateCount);
  const designModeLabel = normalized.mode === "same" ? "Same design for all dates" : "Different design for different dates";
  return (
    <div className="addon-options" onClick={(event) => event.stopPropagation()}>
      <div className="addon-option-title">{label} design</div>
      <div className="design-mode-summary">{designModeLabel}</div>
      {showMode ? (
        <details className="design-mode-details" open={normalized.mode !== "same"}>
          <summary>Change design setup</summary>
          <label>
            <span>Design mode</span>
            <select value={normalized.mode} onChange={(event) => onChange(normalizeDesignOption({ ...normalized, mode: event.target.value as CustomizationOption["mode"], designCount: event.target.value === "same" ? 1 : selectedDateCount }, selectedDateCount))}>
              <option value="same">Same design for all dates</option>
              <option value="per-date">Different design for different dates</option>
            </select>
          </label>
        </details>
      ) : null}
      <p>No extra design-version cost is added. Current add-on price stays unchanged.</p>
    </div>
  );
}

export function AddOnsStep({ data, setData, onBack, onNext }: Props) {
  const [availability, setAvailability] = useState<Record<string, AvailabilityItem>>({});
  const [availabilityWarning, setAvailabilityWarning] = useState("");
  const customizationOptions = data.customizationOptions ?? {
    cart: { mode: "same" as const, designCount: 1 },
    sticker: { mode: "same" as const, designCount: 1 },
    sleeve: { mode: "same" as const, designCount: 1 }
  };
  const totalCups = data.serviceDates.reduce((sum, date) => sum + date.cups, 0);
  const allSmallDates = data.serviceDates.length > 0 && data.serviceDates.every((date) => date.cups < 100);
  const machineRentalFee = getMachineRentalFee(data.serviceDates, data.drinkOrders);
  const enoughLeadTime = hasEnoughLeadTime(data);

  useEffect(() => {
    loadProductAvailability().then((groups) => setAvailability(flattenAvailability(groups))).catch(() => setAvailability({}));
  }, []);

  useEffect(() => {
    const needsLeadTimeRemoval = !enoughLeadTime && data.selectedAddons.some((addon) => leadTimeAddonNames.has(addon.name));
    const normalizedOptions = {
      cart: normalizeDesignOption(customizationOptions.cart, data.serviceDates.length),
      sticker: normalizeDesignOption(customizationOptions.sticker, data.serviceDates.length),
      sleeve: normalizeDesignOption(customizationOptions.sleeve, data.serviceDates.length)
    };
    const optionsChanged =
      normalizedOptions.cart.mode !== customizationOptions.cart.mode ||
      normalizedOptions.cart.designCount !== customizationOptions.cart.designCount ||
      normalizedOptions.sticker.mode !== customizationOptions.sticker.mode ||
      normalizedOptions.sticker.designCount !== customizationOptions.sticker.designCount ||
      normalizedOptions.sleeve.mode !== customizationOptions.sleeve.mode ||
      normalizedOptions.sleeve.designCount !== customizationOptions.sleeve.designCount;

    if (needsLeadTimeRemoval || optionsChanged) {
      setData({
        ...data,
        selectedAddons: needsLeadTimeRemoval ? data.selectedAddons.filter((addon) => !leadTimeAddonNames.has(addon.name)) : data.selectedAddons,
        customizationOptions: normalizedOptions
      });
      if (needsLeadTimeRemoval) setAvailabilityWarning("This add-on requires at least 2 weeks lead time.");
    }
  }, [data, customizationOptions, enoughLeadTime, setData]);

  function isAvailable(name: string): boolean {
    const key = addonAvailabilityKeys[name];
    return !key || availability[key]?.isAvailable !== false;
  }

  function unavailableLabel(name: string) {
    return isAvailable(name) ? null : <span className="unavailable-badge">Unavailable</span>;
  }

  function hasUnavailableSelected() {
    return (
      data.selectedAddons.some((addon) => !isAvailable(addon.name)) ||
      (data.hasCupStickers && !isAvailable("Custom Cup Stickers")) ||
      (data.hasCupSleeves && !isAvailable("Custom Cup Sleeves"))
    );
  }

  function toggleAddon(addon: QuotationAddon) {
    if (!isAvailable(addon.name)) return;
    if (leadTimeAddonNames.has(addon.name) && !enoughLeadTime) {
      setAvailabilityWarning("This add-on requires at least 2 weeks lead time.");
      return;
    }
    const exists = hasAddon(data, addon.name);
    setData({
      ...data,
      selectedAddons: exists ? data.selectedAddons.filter((item) => item.name !== addon.name) : [...data.selectedAddons, addon]
    });
  }

  function setCoffeeCart() {
    if (hasAddon(data, "Coffee Cart")) {
      toggleAddon(coffeeCartAddon);
      return;
    }
    if (!isAvailable("Coffee Cart")) return;
    toggleAddon(coffeeCartAddon);
  }

  function handleNext() {
    if (hasUnavailableSelected()) {
      setAvailabilityWarning("This item is currently unavailable. Please contact Hour Coffee.");
      return;
    }
    onNext();
  }

  function updateCustomizationOption(type: "cart" | "sticker" | "sleeve", option: CustomizationOption) {
    if (option.mode !== "same" && option.designCount > data.serviceDates.length) {
      setAvailabilityWarning("Design versions cannot exceed the number of selected event dates.");
      return;
    }
    const normalized = normalizeDesignOption(option, data.serviceDates.length);
    setData({
      ...data,
      customizationOptions: {
        ...customizationOptions,
        [type]: normalized
      }
    });
  }

  const selectedTotal =
    data.selectedAddons.reduce((sum, addon) => sum + addon.price, 0) +
    (data.hasCupSleeves ? getCupSleevePrice(totalCups) : 0) +
    (data.hasCupStickers ? getCupStickerPrice(totalCups) : 0) +
    machineRentalFee;

  return (
    <div>
      <h2>Add-ons</h2>
      <p className="step-copy">Select any extras for this quotation.</p>

      {machineRentalFee > 0 ? (
        <div className="addon-card active">
          <div>
            <strong>Additional Coffee Machine</strong>
            <p>Required for this order volume.</p>
          </div>
          <span>{formatMoney(machineRentalFee)}</span>
        </div>
      ) : null}

      <div className="addon-card active">
        <div>
          <strong>Smart QR Ordering System {unavailableLabel("Smart QR Ordering System")}</strong>
          <p>Included with every service.</p>
        </div>
        <span>FREE</span>
      </div>

      {allSmallDates ? (
        <div className="addon-card active">
          <div>
            <strong>Premium Table Setup {unavailableLabel("Premium Table Setup")}</strong>
            <p>Included for 50 to 99 cup orders.</p>
          </div>
          <span>FREE</span>
        </div>
      ) : null}

      {data.serviceDates.length ? (
        <button type="button" className={`addon-card ${hasAddon(data, "Coffee Cart") ? "active" : ""}`} disabled={!isAvailable("Coffee Cart") && !hasAddon(data, "Coffee Cart")} onClick={setCoffeeCart}>
          <div>
            <strong>Coffee Cart {unavailableLabel("Coffee Cart")}</strong>
            <p>Optional mobile coffee cart.</p>
          </div>
          <span>{formatMoney(coffeeCartAddon.price)}</span>
        </button>
      ) : null}

      {optionalAddons.map((addon) => {
        const isSelected = hasAddon(data, addon.name);
        return (
          <div className={`addon-card-shell ${isSelected ? "active" : ""}`} key={addon.name}>
            <button className={`addon-card ${isSelected ? "active" : ""}`} type="button" disabled={((!isAvailable(addon.name) || (leadTimeAddonNames.has(addon.name) && !enoughLeadTime)) && !isSelected)} onClick={() => toggleAddon(addon)}>
              <div>
                <strong>{addon.name} {unavailableLabel(addon.name)}</strong>
                <p>{leadTimeAddonNames.has(addon.name) ? "2-week lead time" : "Optional add-on"}</p>
              </div>
              <span>{formatMoney(addon.price)}</span>
            </button>
            {addon.name === "Custom Branded Cart" && isSelected ? (
              <DesignOptions label="Cart" option={customizationOptions.cart} selectedDateCount={data.serviceDates.length} onChange={(option) => updateCustomizationOption("cart", option)} />
            ) : null}
          </div>
        );
      })}

      <div className={`addon-card-shell ${data.hasCupStickers ? "active" : ""}`}>
        <button type="button" className={`addon-card ${data.hasCupStickers ? "active" : ""}`} disabled={!isAvailable("Custom Cup Stickers") && !data.hasCupStickers} onClick={() => setData({ ...data, hasCupStickers: !data.hasCupStickers })}>
          <div>
            <strong>Custom Cup Stickers {unavailableLabel("Custom Cup Stickers")}</strong>
            <p>Price adjusted by cup quantity. 2-week lead time.</p>
          </div>
          <span>{formatMoney(getCupStickerPrice(totalCups))}</span>
        </button>
        {data.hasCupStickers ? (
          <DesignOptions label="Cup sticker" option={customizationOptions.sticker} selectedDateCount={data.serviceDates.length} onChange={(option) => updateCustomizationOption("sticker", option)} />
        ) : null}
      </div>

      <div className={`addon-card-shell ${data.hasCupSleeves ? "active" : ""}`}>
        <button type="button" className={`addon-card ${data.hasCupSleeves ? "active" : ""}`} disabled={!isAvailable("Custom Cup Sleeves") && !data.hasCupSleeves} onClick={() => setData({ ...data, hasCupSleeves: !data.hasCupSleeves })}>
          <div>
            <strong>Custom Cup Sleeves {unavailableLabel("Custom Cup Sleeves")}</strong>
            <p>Price adjusted by cup quantity. 2-week lead time.</p>
          </div>
          <span>{formatMoney(getCupSleevePrice(totalCups))}</span>
        </button>
        {data.hasCupSleeves ? (
          <DesignOptions label="Cup sleeve" option={customizationOptions.sleeve} selectedDateCount={data.serviceDates.length} onChange={(option) => updateCustomizationOption("sleeve", option)} />
        ) : null}
      </div>

      <div className="addon-total">Add-on Total: {formatMoney(selectedTotal)}</div>
      {availabilityWarning ? <div className="warn-summary">{availabilityWarning}</div> : null}
      <StepNavigation onBack={onBack} onNext={handleNext} />
    </div>
  );
}
