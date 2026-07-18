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
  const inputRefs = useRef<Partial<Record<ContactField, HTMLInputElement | null>>>({});
  const customer = data.customer;
  const errors = {
    name: fieldError("name", customer.name),
    phone: fieldError("phone", customer.phone),
    email: fieldError("email", customer.email)
  };
  const isValid = !errors.name && !errors.phone && !errors.email;

  function updateCustomer(field: ContactField, value: string) {
    setData({ ...data, customer: { ...customer, [field]: value } });
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
      const firstInvalid = (["name", "phone", "email"] as ContactField[]).find((field) => Boolean(errors[field]));
      window.requestAnimationFrame(() => inputRefs.current[firstInvalid ?? "name"]?.focus());
      return;
    }
    await onNext();
  }

  return (
    <div>
      <h2>Contact Details</h2>
      <p className="step-copy">Enter the main contact person for this quotation.</p>
      {contactField("name", "Customer Full Name (PIC)")}
      {contactField("phone", "Phone Number", "tel")}
      {contactField("email", "Email Address", "email")}
      <p className="field-reminder">Please complete all required fields before continuing.</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="hc-nav-row">
        <Button type="button" disabled={isChecking} onClick={continueToQuotation}>{isChecking ? "CHECKING..." : "CONTINUE"}</Button>
      </div>
    </div>
  );
}
