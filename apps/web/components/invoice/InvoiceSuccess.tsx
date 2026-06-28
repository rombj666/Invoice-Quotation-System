export function InvoiceSuccess({ invoiceNo }: { invoiceNo: string }) {
  return (
    <div className="success-screen">
      <h2>Invoice Submitted</h2>
      <p>Thank you. Your invoice details and receipt are ready for review.</p>
      <strong>{invoiceNo}</strong>
    </div>
  );
}
