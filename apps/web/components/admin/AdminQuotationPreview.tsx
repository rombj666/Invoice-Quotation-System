import type { QuotationData } from "../../types/quotation";
import { calculateQuotationPricing } from "../../lib/pricing";
import { formatDateLabel, formatMoney } from "../../lib/formatters";
import { getAdminAddonRows } from "../../lib/admin-addons";

export function AdminQuotationPreview({ data }: { data: QuotationData }) {
  const pricing = calculateQuotationPricing(data);
  const addons = getAdminAddonRows(data, pricing.cupStickerFee, pricing.cupSleeveFee);
  return <section className="admin-quotation-summary">
    <h2>Quotation Preview</h2>
    <dl className="admin-summary-grid">
      <div><dt>Event Date</dt><dd>{data.serviceDates.map((date) => date.serviceDate ? formatDateLabel(date.serviceDate) : "Date not selected").join(", ")}</dd></div>
      <div><dt>Total Cups</dt><dd>{pricing.totalCups}</dd></div>
      <div><dt>Baristas per Service Date</dt><dd>{pricing.minimumBaristas === pricing.requiredBaristas ? pricing.requiredBaristas : `${pricing.minimumBaristas}–${pricing.requiredBaristas}`}</dd></div>
    </dl>
    <h3>Price Breakdown</h3>
    <div className="admin-price-row"><span>{pricing.totalCups} cups / base package price</span><strong>{formatMoney(pricing.packageAmount)}</strong></div>
    <h4>Add-ons</h4>
    {addons.length ? addons.map((addon) => <div className="admin-price-row" key={addon.name}><span>{addon.name}</span><span>{addon.price ? formatMoney(addon.price) : "Included"}</span></div>) : <p>-</p>}
    {addons.length ? <p className="admin-muted">Add-on selections are shown within the saved package price, not added a second time.</p> : null}
    <h4>Extra Charges</h4>
    {(data.extraCharges ?? []).filter((charge) => charge.title.trim().toLowerCase() !== "extra serving hour").map((charge) => <div className="admin-price-row" key={charge.id}><span>{charge.title || "Untitled charge"}</span><span>{formatMoney(charge.amount)}</span></div>)}
    {!data.extraCharges?.length ? <p>-</p> : null}
    {pricing.discountAmount ? <div className="admin-price-row"><span>Discount</span><span>−{formatMoney(pricing.discountAmount)}</span></div> : null}
    <div className="admin-price-row total"><strong>Total</strong><strong>{formatMoney(pricing.total)}</strong></div>
  </section>;
}
