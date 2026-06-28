"use client";

import { TextInput } from "../common/FormField";

type Props = {
  eventAddress: string;
  dressCode: string;
  customDressCode: string;
  environment: string;
  environmentNotes: string;
  onEventAddress: (value: string) => void;
  onDressCode: (value: string) => void;
  onCustomDressCode: (value: string) => void;
  onEnvironment: (value: string) => void;
  onEnvironmentNotes: (value: string) => void;
};

export function EventDetailsStep({ eventAddress, dressCode, customDressCode, environment, environmentNotes, onEventAddress, onDressCode, onCustomDressCode, onEnvironment, onEnvironmentNotes }: Props) {
  return (
    <div>
      <h2>Event Details</h2>
      <p className="step-copy">Quick setup info for our team.</p>
      <label className="hc-field">
        <span>Full Event Address</span>
        <textarea value={eventAddress} onChange={(event) => onEventAddress(event.target.value)} placeholder="Include building name, floor, entrance details, postcode and city." />
      </label>
      <div className="choice-group">
        <span>Barista Dress Code</span>
        {["Full Black", "White Top", "Custom"].map((item) => (
          <button className={dressCode === item ? "active" : ""} type="button" key={item} onClick={() => onDressCode(item)}>
            {item}
          </button>
        ))}
      </div>
      {dressCode === "Custom" ? <TextInput label="Custom dress code" value={customDressCode} onChange={(event) => onCustomDressCode(event.target.value)} /> : null}
      <div className="choice-group">
        <span>Event Environment</span>
        {["Indoor", "Partially Shaded", "Outdoors Non-Shaded"].map((item) => (
          <button className={environment === item ? "active" : ""} type="button" key={item} onClick={() => onEnvironment(item)}>
            {item}
          </button>
        ))}
      </div>
      <TextInput label="Environment notes" value={environmentNotes} onChange={(event) => onEnvironmentNotes(event.target.value)} placeholder="Optional setup notes" />
    </div>
  );
}
