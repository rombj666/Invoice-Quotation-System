import Link from "next/link";

export default function QuotationSubmittedPage() {
  return (
    <main className="hc-page">
      <div className="hc-card result-card">
        <h1>Quotation Submitted</h1>
        <div className="ok-summary">Your quotation has been submitted successfully.</div>
        <p>Our team will review it and contact you shortly. Please wait for partner or admin approval before continuing to the invoice step.</p>
        <p className="approval-note">If admin has not approved the quotation, you cannot proceed into the invoice page.</p>
        <div className="result-actions">
          <Link className="hc-button hc-button-primary" href="/invoice">
            Go to Invoice Page
          </Link>
          <Link className="hc-button hc-button-secondary" href="/quotation">
            Create Another Quotation
          </Link>
        </div>
      </div>
    </main>
  );
}
