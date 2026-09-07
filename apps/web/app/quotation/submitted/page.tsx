"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { submittedQuotationStorageKey } from "../../../components/quotation/QuotationShell";

function QuotationSubmittedContent() {
  const searchParams = useSearchParams();
  const quotationNo = searchParams.get("quotationNo") ?? "";

  function createAnotherQuotation() {
    window.localStorage.removeItem(submittedQuotationStorageKey);
    window.localStorage.removeItem("hourCoffeeQuotationDraft");
  }

  return (
    <main className="hc-page">
      <div className="hc-card result-card">
        <h1>Quotation Submitted</h1>
        <p>Your quotation is received and is under review.<br />We will contact you shortly. Thank you.</p>
        {quotationNo ? <p className="quotation-number"><strong>Quotation No.:</strong> {quotationNo}</p> : null}
        <div className="result-actions">
          <Link className="hc-button hc-button-primary" href="/invoice">
            Continue to Invoice
          </Link>
          <Link className="hc-button hc-button-secondary" href="/quotation" onClick={createAnotherQuotation}>
            Create Another Quotation
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function QuotationSubmittedPage() {
  return (
    <Suspense fallback={null}>
      <QuotationSubmittedContent />
    </Suspense>
  );
}
