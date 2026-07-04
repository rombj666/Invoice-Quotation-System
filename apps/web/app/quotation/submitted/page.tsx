import Link from "next/link";

export default async function QuotationSubmittedPage({ searchParams }: { searchParams?: Promise<{ quotationNo?: string }> }) {
  const quotationNo = (await searchParams)?.quotationNo;

  return (
    <main className="hc-page">
      <div className="hc-card result-card">
        <h1>Quotation Submitted</h1>
        <p>Thank you for choosing Hour Coffee.</p>
        <p>Your quotation has been submitted successfully.</p>
        {quotationNo ? <p><strong>Quotation No.:</strong> {quotationNo}</p> : null}
        <p className="muted-text">Our PIC will review it and contact you shortly.</p>
        <p className="approval-note">Invoice access is available after admin approval.</p>
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
