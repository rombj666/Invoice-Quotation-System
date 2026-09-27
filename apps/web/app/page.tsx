import Link from "next/link";

export default function HomePage() {
  return (
    <main className="hc-page">
      <div className="home-hero">
        <h1>Hour Coffee</h1>
        <p>Mobile coffee catering &amp; barista service for your events.</p>
        <div className="home-actions">
          <Link className="hc-button hc-button-primary" href="/orders">My Orders</Link>
          <Link className="hc-button hc-button-secondary" href="/notifications">Notification Center</Link>
          <Link className="hc-button hc-button-secondary" href="/admin">Admin Console</Link>
        </div>
        <p className="home-help">Already approved? <Link href="/invoice">Submit or view your invoice</Link> using your quotation number.</p>
      </div>
    </main>
  );
}
