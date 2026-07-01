import Link from "next/link";

export default async function QuotationContactedPage({ searchParams }: { searchParams?: Promise<{ quotationNo?: string }> }) {
  const quotationNo = (await searchParams)?.quotationNo;

  return (
    <main className="hc-page">
      <div className="hc-card result-card">
        <h1>Partner Contacted</h1>
        <div className="ok-summary">Your quotation has been saved and WhatsApp has been opened for partner discussion.</div>
        {quotationNo ? <p className="approval-note">Quotation No.: {quotationNo}</p> : null}
        <p>You can contact our partner or PIC about this quotation.</p>
        <p className="approval-note">You still need admin approval before you can continue to the invoice page.</p>
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
