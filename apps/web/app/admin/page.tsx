import Link from "next/link";
import { Card } from "../../components/common/Card";

export default function AdminHomePage() {
  return (
    <main className="hc-page landing-page">
      <Card>
        <h1>Hour Coffee Admin</h1>
        <p className="step-copy">Admin dashboard</p>
        <div className="landing-actions">
          <Link className="hc-button hc-button-primary" href="/admin/quotations">
            Quotation List
          </Link>
          <Link className="hc-button hc-button-secondary" href="/admin/invoices">
            Invoice List
          </Link>
          <Link className="hc-button hc-button-secondary" href="/admin/product-availability">
            Product Availability
          </Link>
        </div>
      </Card>
    </main>
  );
}
