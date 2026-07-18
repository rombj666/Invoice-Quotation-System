"use client";

import type { PreviousQuotationSummary } from "../../types/quotation";
import { formatCompactDate } from "../../lib/formatters";
import { Button } from "../common/Button";

type Props = {
  quotations: PreviousQuotationSummary[];
  error: string;
  isLoading: boolean;
  onView: (quotationNo: string) => void;
  onCreateAnother: () => void;
};

export function PreviousQuotationsPanel({ quotations, error, isLoading, onView, onCreateAnother }: Props) {
  return (
    <div>
      <h2>Previous Quotations Found</h2>
      <p className="step-copy">We found quotation records linked to these contact details.</p>
      <div className="previous-quotation-list">
        {quotations.map((quotation) => (
          <div className="previous-quotation-card" key={quotation.quotationNo}>
            <div>
              <strong>{quotation.quotationNo}</strong>
              <span>Created {formatCompactDate(new Date(quotation.createdAt))}</span>
              <span>First event date: {quotation.firstEventDate ? formatCompactDate(quotation.firstEventDate) : "Not set"}</span>
              <span>Status: {quotation.status.replaceAll("_", " ")}</span>
            </div>
            {quotation.canViewQuotation ? (
              <Button type="button" variant="secondary" disabled={isLoading} onClick={() => onView(quotation.quotationNo)}>
                View Previous Quotation
              </Button>
            ) : (
              <span className="invoice-started-label">Invoice process started</span>
            )}
          </div>
        ))}
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="hc-nav-row">
        <Button type="button" disabled={isLoading} onClick={onCreateAnother}>Create Another Quotation</Button>
      </div>
    </div>
  );
}
