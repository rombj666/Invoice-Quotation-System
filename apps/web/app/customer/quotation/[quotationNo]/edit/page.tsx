"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { QuotationShell } from "../../../../../components/quotation/QuotationShell";
import { Card } from "../../../../../components/common/Card";
import { loadQuotationByNo } from "../../../../../lib/quotation-storage";
import type { QuotationData } from "../../../../../types/quotation";

function QuotationEditInner() {
  const params = useParams<{ quotationNo: string }>();
  const searchParams = useSearchParams();
  const quotationNo = decodeURIComponent(params.quotationNo ?? "");
  const phone = searchParams.get("phone") ?? "";
  const email = searchParams.get("email") ?? "";

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
          setError("Quotation not found. It may have been deleted or the link is invalid.");
          return;
        }
        if (found.status !== "RETURNED_FOR_EDIT") {
          setError("This quotation is no longer open for editing. Check My Orders for its current status.");
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
  }, [quotationNo]);

  if (loading) return <main className="hc-page">Loading quotation...</main>;

  if (error || !quotation) {
    return (
      <main className="hc-page">
        <Card>
          <h1>Unable to edit quotation</h1>
          <p className="error">{error || "Quotation not found."}</p>
          <Link className="hc-button hc-button-primary" href={`/orders?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`}>Back to My Orders</Link>
        </Card>
      </main>
    );
  }

  return <QuotationShell editQuotation={quotation} />;
}

export default function QuotationEditPage() {
  return (
    <Suspense fallback={<main className="hc-page">Loading quotation...</main>}>
      <QuotationEditInner />
    </Suspense>
  );
}
