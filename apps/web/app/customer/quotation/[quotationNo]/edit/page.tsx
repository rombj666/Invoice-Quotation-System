import Link from "next/link";
import { Card } from "../../../../../components/common/Card";

export default function CustomerQuotationEditPage() {
  return <main className="hc-page"><Card><h1>Quotation editing unavailable</h1><p>Please contact Hour Coffee if your quotation needs to be changed.</p><Link className="hc-button hc-button-primary" href="/orders">Back to My Orders</Link></Card></main>;
}
