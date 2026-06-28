"use client";

import type { QuotationData } from "../../types/quotation";
import { TextInput } from "../common/FormField";
import { StepNavigation } from "../common/StepNavigation";

type Props = {
  data: QuotationData;
  setData: (data: QuotationData) => void;
  onBack: () => void;
  onNext: () => void;
  error: string;
};

export function QuotationReferenceStep({ data, setData, onBack, onNext, error }: Props) {
  function updateVoucher(value: string) {
    const code = value.toUpperCase();
    setData({ ...data, discountCode: code, discountPercent: code === "FIRST" ? 5 : 0, linkExpiryDays: 7 });
  }

  return (
    <div>
      <h2>Quotation Reference & Discount</h2>
      <p className="step-copy">Set the quotation reference and apply a voucher code if available.</p>
      <TextInput label="Quotation No." value={data.quotationNo} disabled readOnly />
      <TextInput label="Discount voucher code" value={data.discountCode} onChange={(event) => updateVoucher(event.target.value)} placeholder="Enter voucher code" />
      {data.discountCode === "FIRST" ? <div className="ok-summary">Voucher FIRST applied. 5 percent discount.</div> : null}
      <div className="locked-expiry">Link expires in 7 days</div>
      {error ? <p className="error">{error}</p> : null}
      <StepNavigation onBack={onBack} onNext={onNext} />
    </div>
  );
}
