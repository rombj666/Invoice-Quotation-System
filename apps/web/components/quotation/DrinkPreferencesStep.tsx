"use client";

import { useEffect, useMemo, useState } from "react";
import type { DrinkId, DrinkOrderByDate, DrinkOption, QuotationData, ServiceDate } from "../../types/quotation";
import { formatShortDate } from "../../lib/formatters";
import { beverageAvailabilityKeys, flattenAvailability, loadProductAvailability, type AvailabilityItem } from "../../lib/product-availability";
import { Button } from "../common/Button";
import { StepNavigation } from "../common/StepNavigation";

const drinks: DrinkOption[] = [
  { id: "americano", name: "Americano", hasHot: true },
  { id: "latte", name: "Cafe Latte", hasHot: true },
  { id: "chocolate", name: "Dark Chocolate", hasHot: true },
  { id: "lemonade", name: "Lemonade", hasHot: false }
];

const drinkIcons: Record<DrinkId, string> = {
  americano: "\u2615",
  latte: "\u{1F95B}",
  chocolate: "\u{1F36B}",
  lemonade: "\u{1F34B}"
};

type Props = {
  data: QuotationData;
  setData: (data: QuotationData) => void;
  onBack: () => void;
  onNext: () => void;
  error: string;
};

function totalForDate(dateId: string, orders: DrinkOrderByDate): number {
  const order = orders[dateId] ?? {};
  return drinks.reduce((sum, drink) => {
    const quantity = order[drink.id] ?? { ice: 0, hot: 0 };
    return sum + quantity.ice + quantity.hot;
  }, 0);
}

export function DrinkPreferencesStep({ data, setData, onBack, onNext, error }: Props) {
  const [activeDateId, setActiveDateId] = useState(data.serviceDates[0]?.id ?? "");
  const [editingDrinkId, setEditingDrinkId] = useState<DrinkId | null>(null);
  const [modalValues, setModalValues] = useState({ ice: 0, hot: 0 });
  const [modalError, setModalError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [availability, setAvailability] = useState<Record<string, AvailabilityItem>>({});
  const [availabilityWarning, setAvailabilityWarning] = useState("");
  const activeDate = useMemo(() => data.serviceDates.find((date) => date.id === activeDateId) ?? data.serviceDates[0], [activeDateId, data.serviceDates]);
  const letsHourCoffeeDecide = Boolean(data.letHourCoffeeDecideDrinks);

  useEffect(() => {
    loadProductAvailability().then((groups) => setAvailability(flattenAvailability(groups))).catch(() => setAvailability({}));
  }, []);

  useEffect(() => {
    const unavailableDrinkIds = drinks.filter((drink) => availability[beverageAvailabilityKeys[drink.id]]?.isAvailable === false).map((drink) => drink.id);
    if (!unavailableDrinkIds.length) return;
    let changed = false;
    const nextOrders = Object.fromEntries(Object.entries(data.drinkOrders).map(([dateId, order]) => {
      const nextOrder = { ...order };
      unavailableDrinkIds.forEach((drinkId) => {
        if ((nextOrder[drinkId]?.ice ?? 0) > 0 || (nextOrder[drinkId]?.hot ?? 0) > 0) {
          nextOrder[drinkId] = { ice: 0, hot: 0 };
          changed = true;
        }
      });
      return [dateId, nextOrder];
    })) as DrinkOrderByDate;
    if (changed) {
      setAvailabilityWarning("Unavailable beverage quantities were reset to 0.");
      setData({ ...data, drinkOrders: nextOrders });
    }
  }, [availability, data, setData]);

  function updateDrink(drinkId: DrinkId, type: "ice" | "hot", value: number) {
    if (letsHourCoffeeDecide) return;
    if (!activeDate) return;
    const dateOrder = data.drinkOrders[activeDate.id] ?? {};
    const current = dateOrder[drinkId] ?? { ice: 0, hot: 0 };
    setData({
      ...data,
      drinkOrders: {
        ...data.drinkOrders,
        [activeDate.id]: {
          ...dateOrder,
          [drinkId]: { ...current, [type]: Math.max(0, value) }
        }
      }
    });
  }

  function openModal(drinkId: DrinkId) {
    if (!activeDate) return;
    if (availability[beverageAvailabilityKeys[drinkId]]?.isAvailable === false) return;
    if (letsHourCoffeeDecide) {
      return;
    }
    const quantity = data.drinkOrders[activeDate.id]?.[drinkId] ?? { ice: 0, hot: 0 };
    setEditingDrinkId(drinkId);
    setModalValues(quantity);
    setModalError("");
  }

  function closeModal() {
    setEditingDrinkId(null);
    setModalValues({ ice: 0, hot: 0 });
    setModalError("");
  }

  function modalTotal(values = modalValues) {
    if (!editingDrinkId || !activeDate) return 0;
    const drink = drinks.find((item) => item.id === editingDrinkId);
    const otherTotal = drinks.reduce((sum, item) => {
      if (item.id === editingDrinkId) return sum;
      const quantity = data.drinkOrders[activeDate.id]?.[item.id] ?? { ice: 0, hot: 0 };
      return sum + quantity.ice + quantity.hot;
    }, 0);
    return otherTotal + values.ice + (drink?.hasHot ? values.hot : 0);
  }

  function setModalQuantity(type: "ice" | "hot", value: number) {
    const nextValues = { ...modalValues, [type]: Math.max(0, Number.isFinite(value) ? value : 0) };
    setModalValues(nextValues);
    setModalError(modalTotal(nextValues) > activeDate.cups ? "You have exceeded the total cups for this date. Please re-enter the quantity." : "");
  }

  function adjustModal(type: "ice" | "hot", amount: number) {
    const nextValues = { ...modalValues, [type]: Math.max(0, modalValues[type] + amount) };
    if (modalTotal(nextValues) > activeDate.cups) {
      setModalError("You have exceeded the total cups for this date. Please re-enter the quantity.");
      return;
    }
    setModalValues(nextValues);
    setModalError("");
  }

  function saveModal() {
    if (!editingDrinkId || !activeDate) return;
    const drink = drinks.find((item) => item.id === editingDrinkId);
    const hot = drink?.hasHot ? modalValues.hot : 0;
    if (modalTotal({ ice: modalValues.ice, hot }) > activeDate.cups) {
      setModalError("You have exceeded the total cups for this date. Please re-enter the quantity.");
      return;
    }
    const dateOrder = data.drinkOrders[activeDate.id] ?? {};
    setData({
      ...data,
      drinkOrders: {
        ...data.drinkOrders,
        [activeDate.id]: {
          ...dateOrder,
          [editingDrinkId]: { ice: modalValues.ice, hot }
        }
      }
    });
    closeModal();
  }

  function copyToAll() {
    if (!activeDate) return;
    const sourceOrder = data.drinkOrders[activeDate.id] ?? {};
    const nextOrders = { ...data.drinkOrders };
    data.serviceDates.forEach((target: ServiceDate) => {
      if (target.id === activeDate.id) return;
      const scale = target.cups / activeDate.cups;
      const copied = {} as DrinkOrderByDate[string];
      drinks.forEach((drink) => {
        const source = sourceOrder[drink.id] ?? { ice: 0, hot: 0 };
        copied[drink.id] = {
          ice: Math.round(source.ice * scale),
          hot: drink.hasHot ? Math.round(source.hot * scale) : 0
        };
      });
      const copiedTotal = Object.values(copied).reduce((sum, item) => sum + item.ice + item.hot, 0);
      const diff = target.cups - copiedTotal;
      if (diff !== 0) copied.americano.ice = Math.max(0, copied.americano.ice + diff);
      nextOrders[target.id] = copied;
    });
    setData({ ...data, drinkOrders: nextOrders, masterDrinkDate: activeDate.id });
    setCopyMessage("Drinks copied to all selected dates.");
  }

  function toggleSameDistribution(checked: boolean) {
    if (checked) {
      closeModal();
      const resetOrders = Object.fromEntries(
        data.serviceDates.map((date) => [
          date.id,
          {
            americano: { ice: 0, hot: 0 },
            latte: { ice: 0, hot: 0 },
            chocolate: { ice: 0, hot: 0 },
            lemonade: { ice: 0, hot: 0 }
          }
        ])
      ) as DrinkOrderByDate;
      setData({ ...data, drinkOrders: resetOrders, sameDrinkDistribution: false, letHourCoffeeDecideDrinks: true, masterDrinkDate: undefined });
      setCopyMessage("");
    } else {
      setData({ ...data, sameDrinkDistribution: false, letHourCoffeeDecideDrinks: false });
      setCopyMessage("");
    }
  }

  if (!activeDate) return null;

  const assigned = totalForDate(activeDate.id, data.drinkOrders);
  const isModalOverLimit = modalTotal() > activeDate.cups;
  const allBeveragesUnavailable = drinks.every((drink) => availability[beverageAvailabilityKeys[drink.id]]?.isAvailable === false);

  function handleNext() {
    if (allBeveragesUnavailable) {
      setAvailabilityWarning("All beverages are currently unavailable. Please contact Hour Coffee.");
      return;
    }
    const hasUnavailableQuantity = data.serviceDates.some((date) => drinks.some((drink) => {
      if (availability[beverageAvailabilityKeys[drink.id]]?.isAvailable !== false) return false;
      const quantity = data.drinkOrders[date.id]?.[drink.id] ?? { ice: 0, hot: 0 };
      return quantity.ice + quantity.hot > 0;
    }));
    if (hasUnavailableQuantity) {
      setAvailabilityWarning("Unavailable beverage quantities were reset to 0. Please continue with available drinks only.");
      return;
    }
    onNext();
  }

  return (
    <div>
      <h2>Drink preferences</h2>
      <p className="step-copy">Tap a drink to set cup counts. Each day can differ.</p>
      {data.serviceDates.length > 1 ? (
        <div className="tab-row">
          {data.serviceDates.map((date) => (
            <button className={date.id === activeDate.id ? "active" : ""} type="button" key={date.id} onClick={() => setActiveDateId(date.id)}>
              {formatShortDate(date.serviceDate)}
            </button>
          ))}
        </div>
      ) : null}

      <div className="drink-list">
        {drinks.map((drink) => {
          const quantity = data.drinkOrders[activeDate.id]?.[drink.id] ?? { ice: 0, hot: 0 };
          const isUnavailable = availability[beverageAvailabilityKeys[drink.id]]?.isAvailable === false;
          return (
            <button className="drink-row drink-card-button" type="button" key={drink.id} disabled={letsHourCoffeeDecide || isUnavailable} onClick={() => openModal(drink.id)}>
              <strong>
                <span className="drink-icon">{drinkIcons[drink.id]}</span>
                {drink.name}
                {isUnavailable ? <span className="unavailable-badge">Unavailable</span> : null}
              </strong>
              <span>Ice {quantity.ice}</span>
              {drink.hasHot ? <span>Hot {quantity.hot}</span> : <span>Hot not available</span>}
            </button>
          );
        })}
      </div>

      <label className="same-distribution-option decision-option">
        <input type="checkbox" checked={letsHourCoffeeDecide} onChange={(event) => toggleSameDistribution(event.target.checked)} />
        <span>Let Hour Coffee decide the drink distribution for this event.</span>
      </label>

      {!letsHourCoffeeDecide ? (
        <div className={assigned === activeDate.cups ? "ok-summary" : "warn-summary"}>
          Assigned {assigned} of {activeDate.cups} cups for {formatShortDate(activeDate.serviceDate)}
        </div>
      ) : null}

      {data.serviceDates.length > 1 ? (
        <>
          <Button type="button" variant="secondary" onClick={copyToAll} disabled={letsHourCoffeeDecide}>
            Copy same drinks to all dates
          </Button>
        </>
      ) : null}
      {letsHourCoffeeDecide ? <div className="ok-summary">Hour Coffee will decide the drink distribution for this event.</div> : copyMessage ? <div className="ok-summary">{copyMessage}</div> : null}
      {allBeveragesUnavailable ? <div className="warn-summary">All beverages are currently unavailable. Please contact Hour Coffee.</div> : null}
      {availabilityWarning ? <div className="warn-summary">{availabilityWarning}</div> : null}
      {error ? <p className="error">{error}</p> : null}
      <StepNavigation onBack={onBack} onNext={handleNext} />

      {editingDrinkId ? (
        <div className="modal-backdrop">
          <div className="drink-modal">
            <h3>
              <span className="drink-icon">{drinkIcons[editingDrinkId]}</span>
              {drinks.find((drink) => drink.id === editingDrinkId)?.name}
            </h3>
            <div className="modal-grid">
              <div>
                <span>Ice</span>
                <div className="stepper-row">
                  <button type="button" onClick={() => adjustModal("ice", -1)}>
                    -
                  </button>
                  <input type="number" min={0} value={modalValues.ice} onChange={(event) => setModalQuantity("ice", event.target.value === "" ? 0 : Number(event.target.value))} />
                  <button type="button" onClick={() => adjustModal("ice", 1)}>
                    +
                  </button>
                </div>
              </div>
              {drinks.find((drink) => drink.id === editingDrinkId)?.hasHot ? (
                <div>
                  <span>Hot</span>
                  <div className="stepper-row">
                    <button type="button" onClick={() => adjustModal("hot", -1)}>
                      -
                    </button>
                    <input type="number" min={0} value={modalValues.hot} onChange={(event) => setModalQuantity("hot", event.target.value === "" ? 0 : Number(event.target.value))} />
                    <button type="button" onClick={() => adjustModal("hot", 1)}>
                      +
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <p className={isModalOverLimit ? "error" : modalTotal() === activeDate.cups ? "ok-text" : "muted-text"}>
              Assigned {modalTotal()} of {activeDate.cups} cups for {formatShortDate(activeDate.serviceDate)}.
            </p>
            {modalError ? <p className="error">{modalError}</p> : null}
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="button" onClick={saveModal} disabled={isModalOverLimit}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
