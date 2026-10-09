"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card } from "../../../../../components/common/Card";

function QuotationInvoiceInner() {
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const email = searchParams.get("email") ?? "";
  return <main className="hc-page"><Card><h1>Final Invoice</h1><p>Hour Coffee will confirm your event details and send the final invoice directly.</p><p>After you send your payment receipt to Hour Coffee, they will share the customization link with you.</p><Link className="hc-button hc-button-primary" href={`/orders?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`}>Back to My Orders</Link></Card></main>;
}

export default function QuotationInvoicePage() {
  return (
    <Suspense fallback={<main className="hc-page">Loading quotation...</main>}>
      <QuotationInvoiceInner />
    </Suspense>
  );
}
