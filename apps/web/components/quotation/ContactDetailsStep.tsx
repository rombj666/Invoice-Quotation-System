"use client";

import { useRef, useState } from "react";
import type { QuotationData } from "../../types/quotation";
import { hasText, isValidEmail, isValidMalaysiaPhone } from "../../lib/validators";
import { Button } from "../common/Button";

type Props = {
  data: QuotationData;
  setData: (data: QuotationData) => void;
  onNext: () => void | Promise<void>;
  isChecking?: boolean;
  error?: string;
};

type ContactField = "name" | "phone" | "email";

function fieldError(field: ContactField, value: string): string {
  if (field === "name" && !hasText(value)) return "Customer full name is required.";
  if (field === "phone" && !isValidMalaysiaPhone(value)) return "Enter a valid Malaysian phone number.";
  if (field === "email" && !isValidEmail(value.trim())) return "Enter a valid email address.";
  return "";
}

export function ContactDetailsStep({ data, setData, onNext, isChecking = false, error = "" }: Props) {
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [addressTouched, setAddressTouched] = useState(false);
  const inputRefs = useRef<Partial<Record<ContactField, HTMLInputElement | null>>>({});
  const addressRef = useRef<HTMLTextAreaElement | null>(null);
  const customer = data.customer;
  const errors = {
    name: fieldError("name", customer.name),
    phone: fieldError("phone", customer.phone),
    email: fieldError("email", customer.email)
  };
  const addressError = hasText(data.location) ? "" : "Event address is required.";
  const isValid = !errors.name && !errors.phone && !errors.email && !addressError;

  function updateCustomer(field: ContactField, value: string) {
    setData({ ...data, customer: { ...customer, [field]: value } });
  }

  function updateDiscountCode(value: string) {
    const discountCode = value.toUpperCase();
    setData({ ...data, discountCode, discountPercent: discountCode === "FIRST" ? 5 : 0 });
  }

  function contactField(field: ContactField, label: string, type = "text") {
    const error = touched[field] ? errors[field] : "";
    return (
      <label className="hc-field">
        <span>{label}</span>
        <input
          ref={(element) => { inputRefs.current[field] = element; }}
          type={type}
          value={customer[field]}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `contact-${field}-error` : undefined}
          onBlur={() => setTouched((current) => ({ ...current, [field]: true }))}
          onChange={(event) => updateCustomer(field, event.target.value)}
        />
        {error ? <small className="field-error" id={`contact-${field}-error`}>{error}</small> : null}
      </label>
    );
  }

  async function continueToQuotation() {
    if (!isValid) {
      setTouched({ name: true, phone: true, email: true });
      setAddressTouched(true);
      const firstInvalid = (["name", "phone", "email"] as ContactField[]).find((field) => Boolean(errors[field]));
      window.requestAnimationFrame(() => {
        if (firstInvalid) inputRefs.current[firstInvalid]?.focus();
        else addressRef.current?.focus();
      });
      return;
    }
    await onNext();
  }

  return (
    <div className="basic-info-step">
      <h2>Basic Info</h2>
      <p className="step-copy">Tell us who to contact and where your event will be held.</p>
      <div className="basic-info-grid">
      <div className="basic-info-name">{contactField("name", "Customer Full Name")}</div>
      <div>{contactField("phone", "Phone Number", "tel")}</div>
      <div>{contactField("email", "Email Address", "email")}</div>
      <label className="hc-field basic-info-address">
        <span>Event Address</span>
        <textarea
          ref={addressRef}
          value={data.location}
          placeholder="Enter the full event address"
          aria-invalid={Boolean(addressTouched && addressError)}
          aria-describedby={addressTouched && addressError ? "event-address-error" : undefined}
          onBlur={() => setAddressTouched(true)}
          onChange={(event) => setData({ ...data, location: event.target.value })}
        />
        {addressTouched && addressError ? <small className="field-error" id="event-address-error">{addressError}</small> : null}
      </label>
      <label className="hc-field basic-info-discount">
        <span>Discount Code <small>(optional)</small></span>
        <input value={data.discountCode} placeholder="Enter discount code" onChange={(event) => updateDiscountCode(event.target.value)} />
        {data.discountCode === "FIRST" ? <small className="discount-applied">FIRST applied — 5% discount</small> : null}
      </label>
      </div>
      <p className="field-reminder">Please complete all required fields before continuing.</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="hc-nav-row">
        <Button type="button" disabled={isChecking} onClick={continueToQuotation}>{isChecking ? "CHECKING..." : "CONTINUE"}</Button>
      </div>
    </div>
  );
}
