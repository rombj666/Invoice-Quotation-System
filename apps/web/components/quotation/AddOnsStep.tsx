"use client";

import { useEffect, useState } from "react";
import type { CustomizationOption, QuotationAddon, QuotationData } from "../../types/quotation";
import {
  CART_SELECTION_ERROR,
  COFFEE_CART_ADDON_NAME,
  CUSTOM_BRANDED_CART_ADDON_NAME,
  DEFAULT_ADDON_PRICING,
  FIXED_ADDON_DEFAULTS,
  calculateSelectedAddonTotal,
  getConfiguredAddonPricing,
  getConfiguredFixedPrice,
  hasCartAddonConflict,
} from "../../lib/addons";
import { formatMoney } from "../../lib/formatters";
import { addonAvailabilityKeys, flattenAvailability, loadProductAvailability, type AvailabilityItem } from "../../lib/product-availability";
import { getCupSleevePrice, getCupStickerPrice, getMachineRentalFee } from "../../lib/pricing";
import { StepNavigation } from "../common/StepNavigation";

type Props = {
  data: QuotationData;
  setData: (data: QuotationData) => void;
  onBack: () => void;
  onNext: () => void;
  useLatestPrices?: boolean;
  embedded?: boolean;
  nextLabel?: string;
  nextDisabled?: boolean;
  submissionError?: string;
};

const leadTimeAddonNames = new Set(["Custom Branded Cart", "Custom Menu"]);

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
  const usesDifferentDesigns = normalized.mode === "per-date";
  return (
    <div className="addon-options" onClick={(event) => event.stopPropagation()}>
      <div className="addon-design-heading">
        <div className="addon-option-title">{label} design</div>
        <span className={`design-mode-badge ${usesDifferentDesigns ? "per-date" : ""}`}>
          {usesDifferentDesigns ? `${selectedDateCount} designs · one per date` : "One shared design"}
        </span>
      </div>
      {showMode ? (
        <label className="design-mode-checkbox">
          <input
            type="checkbox"
            checked={usesDifferentDesigns}
            onChange={(event) => onChange(normalizeDesignOption({
              mode: event.target.checked ? "per-date" : "same",
              designCount: event.target.checked ? selectedDateCount : 1
            }, selectedDateCount))}
          />
          <span>Need different design for each service date</span>
        </label>
      ) : null}
      <p className="addon-design-price-note">Current add-on price stays unchanged.</p>
    </div>
  );
}

export function AddOnsStep({ data, setData, onBack, onNext, useLatestPrices = true, embedded = false, nextLabel, nextDisabled = false, submissionError = "" }: Props) {
  const [availability, setAvailability] = useState<Record<string, AvailabilityItem>>({});
  const [availabilityWarning, setAvailabilityWarning] = useState("");
  const customizationOptions = data.customizationOptions ?? {
    cart: { mode: "same" as const, designCount: 1 },
    sticker: { mode: "same" as const, designCount: 1 },
    sleeve: { mode: "same" as const, designCount: 1 }
  };
  const totalCups = Number.isFinite(data.totalCups) ? Number(data.totalCups) : data.serviceDates.reduce((sum, date) => sum + date.cups, 0);
  const allSmallDates = data.serviceDates.length > 0 && (Number.isFinite(data.totalCups) ? Number(data.totalCups) < 100 : data.serviceDates.every((date) => date.cups < 100));
  const machineRentalFee = getMachineRentalFee(data.serviceDates, data.drinkOrders);
  const enoughLeadTime = hasEnoughLeadTime(data);
  function fixedAddon(name: keyof typeof FIXED_ADDON_DEFAULTS, item: AvailabilityItem | undefined): QuotationAddon {
    const configuredPrice = getConfiguredFixedPrice(item, FIXED_ADDON_DEFAULTS[name]);
    const savedPrice = data.selectedAddons.find((addon) => addon.name === name)?.price;
    return { name, price: !useLatestPrices && savedPrice !== undefined ? savedPrice : configuredPrice };
  }
  const coffeeCartAddon: QuotationAddon = {
    name: COFFEE_CART_ADDON_NAME,
    price: FIXED_ADDON_DEFAULTS[COFFEE_CART_ADDON_NAME]
  };
  const optionalAddons: QuotationAddon[] = [
    { name: CUSTOM_BRANDED_CART_ADDON_NAME, price: FIXED_ADDON_DEFAULTS[CUSTOM_BRANDED_CART_ADDON_NAME] },
    fixedAddon("Custom Menu", availability.custom_menu),
    fixedAddon("Custom Latte Art Stencil", availability.custom_latte_art_stencil)
  ];
  const [brandedCartAddon, ...otherOptionalAddons] = optionalAddons;
  const coffeeCartSelected = hasAddon(data, COFFEE_CART_ADDON_NAME);
  const hasCartConflict = hasCartAddonConflict(data.selectedAddons);
  const activePricing = data.addonPricing ?? (useLatestPrices ? getConfiguredAddonPricing(availability) : DEFAULT_ADDON_PRICING);

  useEffect(() => {
    loadProductAvailability().then((groups) => setAvailability(flattenAvailability(groups))).catch(() => setAvailability({}));
  }, []);

  useEffect(() => {
    if (!useLatestPrices || !Object.keys(availability).length) return;
    const latestPricing = getConfiguredAddonPricing(availability);
    const latestFixedPrices: Record<string, number> = {
      [COFFEE_CART_ADDON_NAME]: FIXED_ADDON_DEFAULTS[COFFEE_CART_ADDON_NAME],
      [CUSTOM_BRANDED_CART_ADDON_NAME]: FIXED_ADDON_DEFAULTS[CUSTOM_BRANDED_CART_ADDON_NAME],
      "Custom Menu": getConfiguredFixedPrice(availability.custom_menu, FIXED_ADDON_DEFAULTS["Custom Menu"]),
      "Custom Latte Art Stencil": getConfiguredFixedPrice(availability.custom_latte_art_stencil, FIXED_ADDON_DEFAULTS["Custom Latte Art Stencil"])
    };
    const selectedAddons = data.selectedAddons.map((addon) => latestFixedPrices[addon.name] === undefined ? addon : { ...addon, price: latestFixedPrices[addon.name] });
    const pricesChanged = selectedAddons.some((addon, index) => addon.price !== data.selectedAddons[index]?.price);
    const pricingChanged = JSON.stringify(data.addonPricing) !== JSON.stringify(latestPricing);
    if (pricesChanged || pricingChanged) setData({ ...data, selectedAddons, addonPricing: latestPricing });
  }, [availability, data, setData, useLatestPrices]);

  useEffect(() => {
    const needsLeadTimeRemoval = !enoughLeadTime && data.selectedAddons.some((addon) => leadTimeAddonNames.has(addon.name));
    const leadTimeSafeAddons = needsLeadTimeRemoval
      ? data.selectedAddons.filter((addon) => !leadTimeAddonNames.has(addon.name))
      : data.selectedAddons;
    const needsCartNormalization = hasCartAddonConflict(leadTimeSafeAddons);
    const normalizedSelectedAddons = needsCartNormalization
      ? leadTimeSafeAddons.filter((addon) => addon.name !== COFFEE_CART_ADDON_NAME)
      : leadTimeSafeAddons;
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

    if (needsLeadTimeRemoval || needsCartNormalization || optionsChanged) {
      setData({
        ...data,
        selectedAddons: normalizedSelectedAddons,
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
    let selectedAddons = exists
      ? data.selectedAddons.filter((item) => item.name !== addon.name)
      : [...data.selectedAddons.filter((item) => item.name !== addon.name), addon];

    if (!exists && addon.name === COFFEE_CART_ADDON_NAME) {
      selectedAddons = selectedAddons.filter((item) => item.name !== CUSTOM_BRANDED_CART_ADDON_NAME);
    }
    if (!exists && addon.name === CUSTOM_BRANDED_CART_ADDON_NAME) {
      selectedAddons = selectedAddons.filter((item) => item.name !== COFFEE_CART_ADDON_NAME);
    }
    setAvailabilityWarning("");
    setData({
      ...data,
      selectedAddons
    });
  }

  function setCoffeeCart() {
    if (hasAddon(data, COFFEE_CART_ADDON_NAME)) {
      toggleAddon(coffeeCartAddon);
      return;
    }
    if (!isAvailable(COFFEE_CART_ADDON_NAME)) return;
    toggleAddon(coffeeCartAddon);
  }

  function handleNext() {
    if (hasCartConflict) {
      setAvailabilityWarning(CART_SELECTION_ERROR);
      return;
    }
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

  function renderOptionalAddon(addon: QuotationAddon) {
    const isSelected = hasAddon(data, addon.name);
    const isCustomBrandedCart = addon.name === CUSTOM_BRANDED_CART_ADDON_NAME;
    return (
      <div className={`addon-card-shell ${isSelected ? "active" : ""}`} key={addon.name}>
        <button className={`addon-card addon-card-selectable ${isCustomBrandedCart ? "cart-option-card" : ""} ${isSelected ? "active" : ""}`} type="button" aria-pressed={isSelected} disabled={((!isAvailable(addon.name) || (leadTimeAddonNames.has(addon.name) && !enoughLeadTime)) && !isSelected)} onClick={() => toggleAddon(addon)}>
          <div className="addon-card-copy">
            <div className="addon-card-title-row"><strong>{isCustomBrandedCart ? "Branded Cart" : addon.name} {unavailableLabel(addon.name)}</strong><span className={`addon-selection-status ${isSelected ? "selected" : ""}`}>{isSelected ? "Selected" : "Select"}</span></div>
            <p>{isCustomBrandedCart ? "Cart with customer logo. 2-week lead time." : leadTimeAddonNames.has(addon.name) ? "2-week lead time" : "Optional add-on"}</p>
          </div>
          <span className="addon-price">{formatMoney(addon.price)}</span>
        </button>
        {isCustomBrandedCart && isSelected ? (
          <DesignOptions label="Cart" option={customizationOptions.cart} selectedDateCount={data.serviceDates.length} onChange={(option) => updateCustomizationOption("cart", option)} />
        ) : null}
      </div>
    );
  }

  const selectedTotal =
    calculateSelectedAddonTotal(data.selectedAddons) +
    (data.hasCupSleeves ? getCupSleevePrice(totalCups, activePricing.cupSleeve) : 0) +
    (data.hasCupStickers ? getCupStickerPrice(totalCups, activePricing.cupSticker) : 0) +
    machineRentalFee;

  return (
    <div className={embedded ? "quotation-section-panel addons-panel" : undefined}>
      {embedded ? <h3>Add-ons</h3> : <h2>Add-ons</h2>}
      <p className="step-copy">Select any extras for this quotation.</p>

      {machineRentalFee > 0 ? (
        <div className="addon-card active addon-card-included">
          <div className="addon-card-copy">
            <div className="addon-card-title-row"><strong>Additional Coffee Machine</strong><span className="addon-selection-status">Required</span></div>
            <p>Required for this order volume.</p>
          </div>
          <span className="addon-price">{formatMoney(machineRentalFee)}</span>
        </div>
      ) : null}

      {isAvailable("Smart QR Ordering System") ? <div className="addon-card active addon-card-included">
        <div className="addon-card-copy">
          <div className="addon-card-title-row"><strong>Smart QR Ordering System {unavailableLabel("Smart QR Ordering System")}</strong><span className="addon-selection-status">Included</span></div>
          <p>Included with every service.</p>
        </div>
        <span className="addon-price">FREE</span>
      </div> : null}

      {allSmallDates && isAvailable("Premium Table Setup") ? (
        <div className="addon-card active addon-card-included">
          <div className="addon-card-copy">
            <div className="addon-card-title-row"><strong>Premium Table Setup {unavailableLabel("Premium Table Setup")}</strong><span className="addon-selection-status">Included</span></div>
            <p>Included for 50 to 99 cup orders.</p>
          </div>
          <span className="addon-price">FREE</span>
        </div>
      ) : null}

      <div className="addon-group-heading">
        <strong>Cart options</strong>
        <span>Choose one cart style. Selecting another cart replaces the current selection.</span>
      </div>

      {data.serviceDates.length && (isAvailable(COFFEE_CART_ADDON_NAME) || coffeeCartSelected) ? (
        <button type="button" className={`addon-card addon-card-selectable cart-option-card ${coffeeCartSelected ? "active" : ""}`} aria-pressed={coffeeCartSelected} disabled={!isAvailable(COFFEE_CART_ADDON_NAME) && !coffeeCartSelected} onClick={setCoffeeCart}>
          <div className="addon-card-copy">
            <div className="addon-card-title-row"><strong>Standard Cart {unavailableLabel(COFFEE_CART_ADDON_NAME)}</strong><span className={`addon-selection-status ${coffeeCartSelected ? "selected" : ""}`}>{coffeeCartSelected ? "Selected" : "Select"}</span></div>
            <p>Cart without customer logo.</p>
          </div>
          <span className="addon-price">{formatMoney(coffeeCartAddon.price)}</span>
        </button>
      ) : null}

      {isAvailable(brandedCartAddon.name) || hasAddon(data, brandedCartAddon.name) ? renderOptionalAddon(brandedCartAddon) : null}

      <div className="addon-group-heading">
        <strong>Other add-ons</strong>
        <span>Select any additional items for the quotation.</span>
      </div>

      {otherOptionalAddons.filter((addon) => isAvailable(addon.name) || hasAddon(data, addon.name)).map(renderOptionalAddon)}

      {isAvailable("Custom Cup Stickers") || data.hasCupStickers ? <div className={`addon-card-shell ${data.hasCupStickers ? "active" : ""}`}>
        <button type="button" className={`addon-card addon-card-selectable ${data.hasCupStickers ? "active" : ""}`} aria-pressed={data.hasCupStickers} disabled={!isAvailable("Custom Cup Stickers") && !data.hasCupStickers} onClick={() => setData({ ...data, hasCupStickers: !data.hasCupStickers })}>
          <div className="addon-card-copy">
            <div className="addon-card-title-row"><strong>Custom Cup Stickers {unavailableLabel("Custom Cup Stickers")}</strong><span className={`addon-selection-status ${data.hasCupStickers ? "selected" : ""}`}>{data.hasCupStickers ? "Selected" : "Select"}</span></div>
            <p>Price adjusted by cup quantity. 2-week lead time.</p>
          </div>
          <span className="addon-price">{formatMoney(getCupStickerPrice(totalCups, activePricing.cupSticker))}</span>
        </button>
        {data.hasCupStickers ? (
          <DesignOptions label="Cup sticker" option={customizationOptions.sticker} selectedDateCount={data.serviceDates.length} onChange={(option) => updateCustomizationOption("sticker", option)} />
        ) : null}
      </div> : null}

      {isAvailable("Custom Cup Sleeves") || data.hasCupSleeves ? <div className={`addon-card-shell ${data.hasCupSleeves ? "active" : ""}`}>
        <button type="button" className={`addon-card addon-card-selectable ${data.hasCupSleeves ? "active" : ""}`} aria-pressed={data.hasCupSleeves} disabled={!isAvailable("Custom Cup Sleeves") && !data.hasCupSleeves} onClick={() => setData({ ...data, hasCupSleeves: !data.hasCupSleeves })}>
          <div className="addon-card-copy">
            <div className="addon-card-title-row"><strong>Custom Cup Sleeves {unavailableLabel("Custom Cup Sleeves")}</strong><span className={`addon-selection-status ${data.hasCupSleeves ? "selected" : ""}`}>{data.hasCupSleeves ? "Selected" : "Select"}</span></div>
            <p>Price adjusted by cup quantity. 2-week lead time.</p>
          </div>
          <span className="addon-price">{formatMoney(getCupSleevePrice(totalCups, activePricing.cupSleeve))}</span>
        </button>
        {data.hasCupSleeves ? (
          <DesignOptions label="Cup sleeve" option={customizationOptions.sleeve} selectedDateCount={data.serviceDates.length} onChange={(option) => updateCustomizationOption("sleeve", option)} />
        ) : null}
      </div> : null}

      <div className="addon-total"><span>Add-on Total</span><strong>{formatMoney(selectedTotal)}</strong></div>
      {hasCartConflict ? <div className="warn-summary">{CART_SELECTION_ERROR}</div> : null}
      {availabilityWarning && availabilityWarning !== CART_SELECTION_ERROR ? <div className="warn-summary">{availabilityWarning}</div> : null}
      {submissionError ? <p className="error">{submissionError}</p> : null}
      <StepNavigation onBack={onBack} onNext={handleNext} nextLabel={nextLabel} nextDisabled={nextDisabled} />
    </div>
  );
}
