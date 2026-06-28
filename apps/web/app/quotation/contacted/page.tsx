import Link from "next/link";

export default function QuotationContactedPage() {
  return (
    <main className="hc-page">
      <div className="hc-card result-card">
        <h1>Quotation Saved</h1>
        <div className="ok-summary">Your request has been saved and WhatsApp has been opened for partner discussion.</div>
        <p>You can discuss the event details with our partner or PIC. The quotation still needs admin approval before invoice access is available.</p>
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
