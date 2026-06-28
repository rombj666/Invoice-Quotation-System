"use client";

import { useMemo, useState } from "react";
import type { DrinkId, DrinkOrderByDate, DrinkOption, QuotationData, ServiceDate } from "../../types/quotation";
import { formatShortDate } from "../../lib/formatters";
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
  const [copyMessage, setCopyMessage] = useState("");
  const activeDate = useMemo(() => data.serviceDates.find((date) => date.id === activeDateId) ?? data.serviceDates[0], [activeDateId, data.serviceDates]);

  function updateDrink(drinkId: DrinkId, type: "ice" | "hot", value: number) {
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
    if (data.sameDrinkDistribution) {
      setCopyMessage("Drink distribution is locked because same distribution is applied to all dates.");
      return;
    }
    const quantity = data.drinkOrders[activeDate.id]?.[drinkId] ?? { ice: 0, hot: 0 };
    setEditingDrinkId(drinkId);
    setModalValues(quantity);
  }

  function closeModal() {
    setEditingDrinkId(null);
    setModalValues({ ice: 0, hot: 0 });
  }

  function adjustModal(type: "ice" | "hot", amount: number) {
    setModalValues((current) => ({ ...current, [type]: Math.max(0, current[type] + amount) }));
  }

  function saveModal() {
    if (!editingDrinkId || !activeDate) return;
    const drink = drinks.find((item) => item.id === editingDrinkId);
    const otherTotal = drinks.reduce((sum, item) => {
      if (item.id === editingDrinkId) return sum;
      const quantity = data.drinkOrders[activeDate.id]?.[item.id] ?? { ice: 0, hot: 0 };
      return sum + quantity.ice + quantity.hot;
    }, 0);
    const hot = drink?.hasHot ? modalValues.hot : 0;
    if (otherTotal + modalValues.ice + hot > activeDate.cups) return;
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
    setCopyMessage("Drink distribution copied to all selected dates.");
  }

  function toggleSameDistribution(checked: boolean) {
    if (!activeDate) return;
    if (checked) {
      const sourceOrder = data.drinkOrders[activeDate.id] ?? {};
      const nextOrders = { ...data.drinkOrders };
      data.serviceDates.forEach((target: ServiceDate) => {
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
      setData({ ...data, drinkOrders: nextOrders, sameDrinkDistribution: true, masterDrinkDate: activeDate.id });
      setCopyMessage("Drink distribution copied to all selected dates.");
    } else {
      setData({ ...data, sameDrinkDistribution: false });
    }
  }

  if (!activeDate) return null;

  const assigned = totalForDate(activeDate.id, data.drinkOrders);

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
          return (
            <button className="drink-row drink-card-button" type="button" key={drink.id} disabled={data.sameDrinkDistribution} onClick={() => openModal(drink.id)}>
              <strong>
                <span className="drink-icon">{drinkIcons[drink.id]}</span>
                {drink.name}
              </strong>
              <span>Ice {quantity.ice}</span>
              {drink.hasHot ? <span>Hot {quantity.hot}</span> : <span>Hot not available</span>}
            </button>
          );
        })}
      </div>

      <div className={assigned === activeDate.cups ? "ok-summary" : "warn-summary"}>
        Assigned {assigned} of {activeDate.cups} cups for {formatShortDate(activeDate.serviceDate)}
      </div>

      {data.serviceDates.length > 1 ? (
        <>
          <Button type="button" variant="secondary" onClick={copyToAll}>
            Copy same drinks to all dates
          </Button>
          <label className="same-distribution-option">
            <input type="checkbox" checked={data.sameDrinkDistribution} onChange={(event) => toggleSameDistribution(event.target.checked)} />
            <span>Use the same drink distribution for all selected dates</span>
          </label>
          {data.sameDrinkDistribution ? <div className="ok-summary">Same drink distribution is applied to all selected dates.</div> : null}
        </>
      ) : null}
      {copyMessage ? <div className="ok-summary">{copyMessage}</div> : null}
      {error ? <p className="error">{error}</p> : null}
      <StepNavigation onBack={onBack} onNext={onNext} />

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
                  <input type="number" min={0} value={modalValues.ice} onChange={(event) => setModalValues({ ...modalValues, ice: Math.max(0, Number(event.target.value)) })} />
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
                    <input type="number" min={0} value={modalValues.hot} onChange={(event) => setModalValues({ ...modalValues, hot: Math.max(0, Number(event.target.value)) })} />
                    <button type="button" onClick={() => adjustModal("hot", 1)}>
                      +
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <p className={totalForDate(activeDate.id, data.drinkOrders) === activeDate.cups ? "ok-text" : "muted-text"}>
              Current assigned total: {assigned} of {activeDate.cups} cups.
            </p>
            <div className="modal-actions">
              <Button type="button" variant="secondary" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="button" onClick={saveModal}>
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
