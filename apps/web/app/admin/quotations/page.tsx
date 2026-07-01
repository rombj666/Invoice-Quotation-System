"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { calculatePricing } from "../../../lib/pricing";
import { approveQuotation, deleteQuotation, loadAllQuotations } from "../../../lib/quotation-storage";
import { formatDateLabel, formatMoney } from "../../../lib/formatters";
import type { QuotationData } from "../../../types/quotation";

export default function AdminQuotationListPage() {
  const [quotations, setQuotations] = useState<QuotationData[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    setError("");
    setSuccess("");
    try {
      setQuotations(await loadAllQuotations());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load quotations.");
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function approve(quotationNo: string) {
    if (!window.confirm("Are you sure you want to approve this quotation?")) return;
    setError("");
    setSuccess("");
    try {
      const approved = await approveQuotation(quotationNo);
      setQuotations((current) => current.map((quotation) => (quotation.quotationNo === quotationNo ? approved : quotation)));
      setSuccess("Quotation approved successfully.");
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Unable to approve quotation.");
    }
  }

  async function remove(quotationNo: string) {
    await deleteQuotation(quotationNo);
    await refresh();
  }

  return (
    <main className="hc-page admin-page">
      <Card className="admin-card">
        <div className="admin-nav">
          <Link href="/admin">Admin Home</Link>
          <Link href="/quotation">Quotation Page</Link>
          <Link href="/invoice">Invoice Page</Link>
          <Link href="/admin/invoices">Invoice List</Link>
        </div>
        <h1>Quotation List</h1>
        {error ? <p className="error">{error}</p> : null}
        {success ? <div className="ok-summary">{success}</div> : null}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Quotation No.</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Event date</th>
                <th>Total cups</th>
                <th>Total amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((quotation) => {
                const pricing = calculatePricing(quotation);
                const status = quotation.status ?? "PENDING_APPROVAL";
                const isApproved = status === "APPROVED";
                return (
                  <tr key={quotation.quotationNo}>
                    <td>{quotation.quotationNo}</td>
                    <td>{quotation.customer.name}</td>
                    <td>{quotation.customer.phone}</td>
                    <td>{quotation.serviceDates[0] ? formatDateLabel(quotation.serviceDates[0].serviceDate) : "-"}</td>
                    <td>{pricing.totalCups}</td>
                    <td>{formatMoney(pricing.total)}</td>
                    <td><span className={`admin-status-badge ${isApproved ? "approved" : "pending"}`}>{isApproved ? "APPROVED" : "PENDING APPROVAL"}</span></td>
                    <td>
                      <div className="admin-actions">
                        <Link href={`/admin/quotations/${quotation.quotationNo}`}>View Details</Link>
                        {!isApproved ? (
                          <button className="admin-approve-button" type="button" onClick={() => approve(quotation.quotationNo)}>
                            Approve Quotation
                          </button>
                        ) : null}
                        <button type="button" onClick={() => remove(quotation.quotationNo)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!quotations.length ? (
                <tr>
                  <td colSpan={8}>No quotations saved yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
