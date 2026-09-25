import { Suspense } from "react";
import { LegacyInvoiceEntry } from "../../components/invoice/LegacyInvoiceEntry";

export default function InvoicePage() {
  return (
    <Suspense fallback={<main className="hc-page">Loading invoice...</main>}>
      <LegacyInvoiceEntry />
    </Suspense>
  );
}
