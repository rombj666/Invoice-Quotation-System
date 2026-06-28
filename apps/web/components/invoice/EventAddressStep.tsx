"use client";

import { TextArea } from "../common/FormField";

export function EventAddressStep({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <h2>Event Address</h2>
      <p className="step-copy">Where is your event being held?</p>
      <TextArea label="Full Event Address" value={value} onChange={(event) => onChange(event.target.value)} hint="Include building name, floor, entrance details, postcode and city." />
    </div>
  );
}
