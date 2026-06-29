export function InvoiceSuccess({ invoiceNo }: { invoiceNo: string }) {
  return (
    <div className="success-screen">
      <h2>Invoice Submitted</h2>
      <p>Thank you for your time and for choosing Hour Coffee.</p>
      <p>Your invoice and receipt have been submitted successfully. Our team will review your payment and contact you if anything else is needed.</p>
      <strong>{invoiceNo}</strong>
    </div>
  );
}
