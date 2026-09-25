"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "../common/Card";
import { loadInvoiceByNo } from "../../lib/invoice-storage";
import type { InvoiceDetails } from "../../types/invoice";
import { SubmittedInvoiceView } from "./SubmittedInvoiceView";

export function LegacyInvoiceEntry() {
  const search = useSearchParams();
  const [legacyInvoice, setLegacyInvoice] = useState<InvoiceDetails | null>(null);
  useEffect(() => {
    const invoiceNo = search.get("invoiceNo");
    const saved = window.sessionStorage.getItem("hourCoffeeSubmittedInvoiceIdentity");
    if (!invoiceNo || !saved) return;
    try {
      const identity = JSON.parse(saved) as { invoiceNo?: string };
      if (identity.invoiceNo === invoiceNo) void loadInvoiceByNo(invoiceNo).then(setLegacyInvoice);
    } catch { window.sessionStorage.removeItem("hourCoffeeSubmittedInvoiceIdentity"); }
  }, [search]);
  if (legacyInvoice) return <SubmittedInvoiceView invoice={legacyInvoice} />;
  return <main className="hc-page"><Card><h2>This customer flow has moved</h2><p>Please use the secure Customer Portal link provided by Hour Coffee.</p></Card></main>;
}
