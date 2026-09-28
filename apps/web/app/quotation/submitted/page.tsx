"use client";

import { clearQuotationForm } from "../../../lib/quotation-form-state";

export default function QuotationSubmittedPage() {
  function createNewQuotation() {
    clearQuotationForm();
    // A fresh document discards any cached form component and starts with its defaults.
    window.location.replace("/quotation");
  }

  return (
    <main className="hc-page">
      <div className="hc-card result-card">
        <h1>Quotation Submitted</h1>
        <p>Thank you. Hour Coffee will contact you as soon as possible.</p>
        <div className="result-actions">
          <button className="hc-button hc-button-primary" type="button" onClick={createNewQuotation}>
            Create New Quotation
          </button>
        </div>
      </div>
    </main>
  );
}
