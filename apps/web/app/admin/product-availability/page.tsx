"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { loadProductAvailability, updateProductAvailability, type AvailabilityGroups } from "../../../lib/product-availability";

export default function ProductAvailabilityPage() {
  const [groups, setGroups] = useState<AvailabilityGroups>({});
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      setGroups(await loadProductAvailability());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load product availability.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function toggle(itemKey: string, isAvailable: boolean) {
    setError("");
    try {
      const updated = await updateProductAvailability(itemKey, !isAvailable);
      setGroups((current) => ({
        ...current,
        [updated.category]: (current[updated.category] ?? []).map((item) => (item.itemKey === updated.itemKey ? updated : item))
      }));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update availability.");
    }
  }

  return (
    <main className="hc-page admin-page">
      <Card className="admin-card">
        <div className="admin-nav">
          <Link href="/admin">Admin Home</Link>
          <Link href="/admin/quotations">Quotation List</Link>
          <Link href="/admin/invoices">Invoice List</Link>
          <Link href="/admin/product-availability">Product Availability</Link>
        </div>
        <h1>Product Availability</h1>
        {error ? <p className="error">{error}</p> : null}
        {["Beverages", "Add-on Features"].map((category) => (
          <section className="availability-section" key={category}>
            <h2>{category}</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Item</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {(groups[category] ?? []).map((item) => (
                    <tr key={item.itemKey}>
                      <td>{item.itemName}</td>
                      <td><span className={`admin-status-badge ${item.isAvailable ? "approved" : "deleted"}`}>{item.isAvailable ? "Available" : "Unavailable"}</span></td>
                      <td>
                        <button className={`availability-action-button ${item.isAvailable ? "mark-unavailable" : "mark-available"}`} type="button" onClick={() => toggle(item.itemKey, item.isAvailable)}>
                          {item.isAvailable ? "Mark Unavailable" : "Mark Available"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </Card>
    </main>
  );
}
