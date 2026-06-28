import Link from "next/link";
import { Card } from "../../components/common/Card";

export default function AdminHomePage() {
  return (
    <main className="hc-page landing-page">
      <Card>
        <h1>Hour Coffee Admin</h1>
        <p className="step-copy">Local testing dashboard</p>
        <div className="landing-actions">
          <Link className="hc-button hc-button-primary" href="/quotation">
            Go to Quotation Page
          </Link>
          <Link className="hc-button hc-button-secondary" href="/invoice">
            Go to Invoice Page
          </Link>
          <Link className="hc-button hc-button-secondary" href="/admin/quotations">
            View Quotation List
          </Link>
          <Link className="hc-button hc-button-secondary" href="/admin/invoices">
            View Invoice List
          </Link>
        </div>
      </Card>
    </main>
  );
}
