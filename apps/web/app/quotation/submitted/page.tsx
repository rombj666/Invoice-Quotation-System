import Link from "next/link";

export default async function QuotationSubmittedPage({ searchParams }: { searchParams?: Promise<{ quotationNo?: string }> }) {
  const quotationNo = (await searchParams)?.quotationNo;

  return (
    <main className="hc-page">
      <div className="hc-card result-card">
        <h1>Quotation Submitted</h1>
        <div className="ok-summary">Your quotation has been submitted successfully.</div>
        {quotationNo ? <p className="approval-note">Quotation No.: {quotationNo}</p> : null}
        <p>Thank you for your time and for choosing Hour Coffee.</p>
        <p>Our PIC or partner will review your quotation and contact you shortly.</p>
        <p className="approval-note">You can only continue to the invoice page after admin approval.</p>
        <div className="result-actions">
          <Link className="hc-button hc-button-primary" href="/invoice">
            Continue to Invoice
          </Link>
          <Link className="hc-button hc-button-secondary" href="/quotation">
            Create Another Quotation
          </Link>
        </div>
      </div>
    </main>
  );
}
