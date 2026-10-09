"use client";

export const acknowledgementLabels = [
  "I acknowledge the barista(s) must have access to the service space 60–90 minutes prior to my scheduled service time.",
  "I acknowledge Hour Coffee needs a service space of 1.52 m by 1.52 m per service cart with room for a queue.",
  "I acknowledge Hour Coffee requires one dedicated 13 amp power socket, 240 volt, and it must be within 3.05 m from the cart.",
  "I acknowledge the service location must be wheelchair accessible.",
  "I acknowledge that no refund will be issued for drinks not fully redeemed by the end of my event(s). All cups are prepared based on the confirmed order quantity."
];

type Props = {
  checked: boolean[];
  onChange: (checked: boolean[]) => void;
};

export function AcknowledgementsStep({ checked, onChange }: Props) {
  return (
    <div>
      <h2>Acknowledgements</h2>
      <div className="ack-card">
        {acknowledgementLabels.map((label, index) => (
          <label className="ack-item" key={label}>
            <input
              type="checkbox"
              checked={checked[index] ?? false}
              onChange={(event) => {
                const next = [...checked];
                next[index] = event.target.checked;
                onChange(next);
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
