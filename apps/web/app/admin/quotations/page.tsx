"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { normalizeMalaysiaWhatsAppNumber, openAdminCustomerWhatsApp } from "../../../lib/contact";
import { calculatePricing } from "../../../lib/pricing";
import { approveQuotation, deleteQuotation, loadAllQuotations } from "../../../lib/quotation-storage";
import { formatDateLabel, formatMalaysiaDateInput, formatMoney } from "../../../lib/formatters";
import type { QuotationData } from "../../../types/quotation";

export default function AdminQuotationListPage() {
  const [quotations, setQuotations] = useState<QuotationData[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState("");
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

  const filtered = quotations.filter((quotation) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [quotation.quotationNo, quotation.customer.name, quotation.customer.companyName, quotation.customer.phone].some((value) => value?.toLowerCase().includes(query));
    const malaysiaDate = quotation.createdAt ? formatMalaysiaDateInput(quotation.createdAt) : "";
    return matchesSearch && (!followUpFilter || quotation.followUpStatus === followUpFilter) && (!statusFilter || quotation.status === statusFilter) && (!dateFilter || malaysiaDate === dateFilter);
  });

  return (
    <main className="admin-page">
      <Card className="admin-card">
        <div className="admin-page-header"><div><p className="admin-eyebrow">Leads</p><h1>Quotation List</h1><p>Search, filter, review and update submitted quotations.</p></div></div>
        {error ? <p className="error">{error}</p> : null}
        {success ? <div className="ok-summary">{success}</div> : null}
        <div className="admin-list-filters">
          <input aria-label="Search quotations" placeholder="Search quotation, customer, company or phone" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Follow-up status" value={followUpFilter} onChange={(event) => setFollowUpFilter(event.target.value)}><option value="">All follow-up statuses</option>{["NEW","CONTACTED","FOLLOW_UP","WON","LOST"].map((value)=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select>
          <select aria-label="Quotation status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All quotation statuses</option>{["DRAFT","PENDING_APPROVAL","APPROVED","REVIEWED","SENT","CONVERTED_TO_INVOICE","CANCELLED"].map((value)=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select>
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
                <th>Follow-up status</th>
                <th>Submitted date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quotation) => {
                const pricing = calculatePricing(quotation);
                const status = quotation.status ?? "PENDING_APPROVAL";
                const isApproved = status === "APPROVED";
                return (
                  <tr key={quotation.quotationNo}>
                    <td>{quotation.quotationNo}</td>
                    <td>{quotation.customer.name}</td>
                    <td>{quotation.customer.companyName || "-"}</td>
                    <td>{quotation.serviceDates[0] ? formatDateLabel(quotation.serviceDates[0].serviceDate) : "-"}</td>
                    <td>{formatMoney(pricing.total)}</td>
                    <td><span className={`admin-status-badge ${isApproved ? "approved" : "pending"}`}>{status.replaceAll("_", " ")}</span></td>
                    <td><span className={`admin-status-badge follow-${(quotation.followUpStatus ?? "NEW").toLowerCase()}`}>{(quotation.followUpStatus ?? "NEW").replaceAll("_", " ")}</span></td>
                    <td>{quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }) : "-"}</td>
                    <td>
                      <div className="admin-actions">
                        <Link href={`/admin/quotations/${quotation.quotationNo}`}>View</Link>
                        <Link href={`/admin/quotations/${quotation.quotationNo}/edit`}>Edit</Link>
                        {!isApproved ? (
                          <button className="admin-approve-button" type="button" onClick={() => approve(quotation.quotationNo)}>
                            Approve Quotation
                          </button>
                        ) : null}
                        {!isApproved ? (
                          <button type="button" onClick={() => remove(quotation.quotationNo)}>
                            Delete
                          </button>
                        ) : null}
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
                  <td colSpan={9}>No quotations match the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
