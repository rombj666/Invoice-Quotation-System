"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { normalizeMalaysiaWhatsAppNumber, openAdminCustomerWhatsApp } from "../../../lib/contact";
import { calculateQuotationPricing } from "../../../lib/pricing";
import { deleteQuotation, loadAllQuotations } from "../../../lib/quotation-storage";
import { formatDateLabel, formatMalaysiaDateInput, formatMoney } from "../../../lib/formatters";
import type { QuotationData } from "../../../types/quotation";

export default function AdminQuotationListPage() {
  const [quotations, setQuotations] = useState<QuotationData[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

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

  async function remove(quotationNo: string) {
    if (!window.confirm(`Permanently delete quotation ${quotationNo}? This cannot be undone.`)) return;
    setError(""); setSuccess("");
    try {
      await deleteQuotation(quotationNo);
      setQuotations((current) => current.filter((quotation) => quotation.quotationNo !== quotationNo));
      setSuccess(`Quotation ${quotationNo} permanently deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete quotation.");
    }
  }

  const filtered = quotations.filter((quotation) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [quotation.quotationNo, quotation.customer.name, quotation.customer.companyName, quotation.customer.phone].some((value) => value?.toLowerCase().includes(query));
    const malaysiaDate = quotation.createdAt ? formatMalaysiaDateInput(quotation.createdAt) : "";
    return matchesSearch && (!statusFilter || quotation.status === statusFilter) && (!dateFilter || malaysiaDate === dateFilter);
  });

  return (
    <main className="admin-page">
      <Card className="admin-card">
        <div className="admin-page-header"><div><p className="admin-eyebrow">Leads</p><h1>Quotation List</h1><p>Search, filter, review and update submitted quotations.</p></div></div>
        {error ? <p className="error">{error}</p> : null}
        {success ? <div className="ok-summary">{success}</div> : null}
        <div className="admin-list-filters">
          <input aria-label="Search quotations" placeholder="Search quotation, customer, company or phone" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Quotation status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All quotation statuses</option>{[["PENDING_APPROVAL", "Pending Approval"], ["GENERATED_INVOICE", "Generated Invoice"], ["COMPLETED", "Completed"]].map(([value, label])=><option key={value} value={value}>{label}</option>)}</select>
          <input aria-label="Submitted date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Quotation No.</th>
                <th>Customer</th>
                <th>Company</th>
                <th>Event date</th>
                <th>Total</th>
                <th>Quotation status</th>
                <th>Submitted date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quotation) => {
                const pricing = calculateQuotationPricing(quotation);
                const status = quotation.status ?? "PENDING_APPROVAL";
                const statusLabel = status === "PENDING_APPROVAL" ? "Pending Approval" : status === "GENERATED_INVOICE" ? "Generated Invoice" : "Completed";
                const statusClass = status === "PENDING_APPROVAL" ? "pending" : "approved";
                return (
                  <tr key={quotation.quotationNo}>
                    <td>{quotation.quotationNo}</td>
                    <td>{quotation.customer.name}</td>
                    <td>{quotation.customer.companyName || "-"}</td>
                    <td>{quotation.serviceDates[0] ? formatDateLabel(quotation.serviceDates[0].serviceDate) : "-"}</td>
                    <td>{formatMoney(pricing.total)}</td>
                    <td><span className={`admin-status-badge ${statusClass}`}>{statusLabel}</span></td>
                    <td>{quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }) : "-"}</td>
                    <td>
                      <div className="admin-actions">
                        <Link href={`/admin/quotations/${quotation.quotationNo}`}>View</Link>
                        {status === "PENDING_APPROVAL" && !quotation.hasInvoice ? <Link href={`/admin/quotations/${quotation.quotationNo}/edit`}>Edit</Link> : null}
                        {status === "PENDING_APPROVAL" && !quotation.hasInvoice ? <Link className="admin-approve-button" href={`/admin/quotations/${quotation.quotationNo}/generate-invoice`}>Generate Invoice</Link> : null}
                        {status === "PENDING_APPROVAL" && !quotation.hasInvoice ? (
                          <button type="button" onClick={() => remove(quotation.quotationNo)}>
                            Delete
                          </button>
                        ) : null}
                        {quotation.invoiceNo ? <Link href={`/admin/invoices/${quotation.invoiceNo}`}>View Existing Invoice</Link> : null}
                        <button type="button" onClick={() => openAdminCustomerWhatsApp(quotation)} disabled={!normalizeMalaysiaWhatsAppNumber(quotation.customer.phone)}>
                          {normalizeMalaysiaWhatsAppNumber(quotation.customer.phone) ? "Contact Customer" : "No phone number"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={8}>No quotations match the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
