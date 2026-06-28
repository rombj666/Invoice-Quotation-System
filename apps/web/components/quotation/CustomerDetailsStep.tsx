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
      <h2>Customer Details</h2>
      <p className="step-copy">These will be pre-filled on the customer's invoice.</p>
      <div className="section-divider">Personal Contact</div>
      <TextInput label="Customer Full Name (PIC)" value={customer.name} onChange={(event) => updateCustomer({ name: event.target.value })} />
      <TextInput label="Phone Number" value={customer.phone} onChange={(event) => updateCustomer({ phone: event.target.value })} />
      <TextInput label="Email Address" value={customer.email} onChange={(event) => updateCustomer({ email: event.target.value })} />
      <div className="section-divider">Company / Organisation</div>
      <TextInput label="Company / Organisation Name" value={customer.companyName} onChange={(event) => updateCustomer({ companyName: event.target.value })} />
      <TextInput label="Company Registration No." value={customer.companyRegNo} onChange={(event) => updateCustomer({ companyRegNo: event.target.value })} />
      <TextArea label="Company / Billing Address" value={customer.billingAddress} onChange={(event) => updateCustomer({ billingAddress: event.target.value })} />
      {error ? <p className="error">{error}</p> : null}
      <StepNavigation onBack={onBack} onNext={onNext} />
    </div>
  );
}
