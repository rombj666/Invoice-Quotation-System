import { Suspense } from "react";
import { InvoiceShell } from "../../components/invoice/InvoiceShell";

export default function InvoicePage() {
  return (
    <Suspense fallback={<main className="hc-page">Loading invoice...</main>}>
      <InvoiceShell />
    </Suspense>
  );
}
