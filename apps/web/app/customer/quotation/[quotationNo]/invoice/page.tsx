"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { InvoiceShell } from "../../../../../components/invoice/InvoiceShell";
import { Card } from "../../../../../components/common/Card";
import { loadQuotationByNo } from "../../../../../lib/quotation-storage";
import type { QuotationData } from "../../../../../types/quotation";

function QuotationInvoiceInner() {
  const params = useParams<{ quotationNo: string }>();
  const searchParams = useSearchParams();
  const quotationNo = decodeURIComponent(params.quotationNo ?? "");
  const phone = (searchParams.get("phone") ?? "").replace(/\D/g, "");
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();

  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!quotationNo) {
      setError("Missing quotation number.");
      setLoading(false);
      return;
    }
    loadQuotationByNo(quotationNo)
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setError("Quotation not found.");
          return;
        }
        if (found.status !== "APPROVED") {
          setError("This quotation is not approved yet, so an invoice cannot be submitted for it.");
          return;
        }
        const foundPhone = (found.customer.phone ?? "").replace(/\D/g, "");
        const foundEmail = (found.customer.email ?? "").trim().toLowerCase();
        const identityMatches = (phone && phone === foundPhone) || (email && email === foundEmail);
        if (!identityMatches) {
          setError("The phone number or email does not match this quotation.");
          return;
        }
        setQuotation(found);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load this quotation.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [quotationNo, phone, email]);

  if (loading) return <main className="hc-page">Loading quotation...</main>;

  if (error || !quotation) {
    return (
      <main className="hc-page">
        <Card>
          <h1>Unable to start invoice</h1>
          <p className="error">{error || "Quotation not found."}</p>
          <Link className="hc-button hc-button-primary" href={`/orders?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`}>Back to My Orders</Link>
        </Card>
      </main>
    );
  }

  return <InvoiceShell initialQuotationNo={quotationNo} />;
}

export default function QuotationInvoicePage() {
  return (
    <Suspense fallback={<main className="hc-page">Loading quotation...</main>}>
      <QuotationInvoiceInner />
    </Suspense>
  );
}
