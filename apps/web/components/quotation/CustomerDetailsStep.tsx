"use client";

import type { QuotationData } from "../../types/quotation";
import { TextArea, TextInput } from "../common/FormField";
import { StepNavigation } from "../common/StepNavigation";

type Props = {
  data: QuotationData;
  setData: (data: QuotationData) => void;
  onBack: () => void;
  onNext: () => void;
  error: string;
};

export function CustomerDetailsStep({ data, setData, onBack, onNext, error }: Props) {
  const customer = data.customer;

  function updateCustomer(patch: Partial<typeof customer>) {
    setData({ ...data, customer: { ...customer, ...patch } });
  }

  return (
    <div>
      <h2>Company Details</h2>
      <p className="step-copy">Enter the company and billing details for this quotation.</p>
      <TextInput label="Company / Organisation Name" value={customer.companyName} onChange={(event) => updateCustomer({ companyName: event.target.value })} />
      <TextInput label="Company Registration No." value={customer.companyRegNo} onChange={(event) => updateCustomer({ companyRegNo: event.target.value })} />
      <TextArea label="Company / Billing Address" value={customer.billingAddress} onChange={(event) => updateCustomer({ billingAddress: event.target.value })} />
      {error ? <p className="error">{error}</p> : null}
      <StepNavigation onBack={onBack} onNext={onNext} />
    </div>
  );
}
