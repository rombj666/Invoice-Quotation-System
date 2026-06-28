"use client";

import type { QuotationData } from "../../types/quotation";
import { SelectField, TextArea } from "../common/FormField";
import { StepNavigation } from "../common/StepNavigation";

type Props = {
  data: QuotationData;
  setData: (data: QuotationData) => void;
  onBack: () => void;
  onNext: () => void;
  error: string;
};

const locations = ["KL City Centre", "Petaling Jaya", "Subang Jaya", "Shah Alam", "Klang", "Kepong", "Puchong", "Cheras", "Bukit Jalil", "Others (Klang Valley / KL only)"];
const eventTypes = ["Wedding", "Birthday", "Brand Launch", "Corporate event", "Private event", "Others"];

export function LocationStep({ data, setData, onBack, onNext, error }: Props) {
  return (
    <div>
      <h2>Where is the event?</h2>
      <SelectField label="Location" value={data.location} onChange={(event) => setData({ ...data, location: event.target.value })}>
        <option value="">Select location</option>
        {locations.map((location) => (
          <option key={location}>{location}</option>
        ))}
      </SelectField>
      {data.location.startsWith("Others") ? (
        <TextArea label="Full address" value={data.fullAddress} onChange={(event) => setData({ ...data, fullAddress: event.target.value })} />
      ) : null}
      <SelectField label="Event Type" value={data.eventType} onChange={(event) => setData({ ...data, eventType: event.target.value })}>
        <option value="">Select type</option>
        {eventTypes.map((eventType) => (
          <option key={eventType}>{eventType}</option>
        ))}
      </SelectField>
      {data.eventType === "Others" ? (
        <TextArea label="Please describe the event type" value={data.customEventType} onChange={(event) => setData({ ...data, customEventType: event.target.value })} />
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <StepNavigation onBack={onBack} onNext={onNext} />
    </div>
  );
}
