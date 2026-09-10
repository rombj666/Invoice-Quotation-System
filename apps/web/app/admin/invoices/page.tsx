"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { calculatePricing } from "../../../lib/invoice-pricing";
import { loadAllInvoices } from "../../../lib/invoice-storage";
import { formatDateLabel, formatMalaysiaDateInput, formatMoney } from "../../../lib/formatters";
import type { InvoiceDetails } from "../../../types/invoice";

export default function AdminInvoiceListPage() {
  const [invoices, setInvoices] = useState<InvoiceDetails[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    loadAllInvoices()
      .then(setInvoices)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load invoices."));
  }, []);

  const filtered = invoices.filter((invoice) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [invoice.invoiceNo, invoice.quotation.quotationNo, invoice.quotation.customer.name, invoice.quotation.customer.companyName].some((value) => value?.toLowerCase().includes(query));
    const malaysiaDate = invoice.createdAt ? formatMalaysiaDateInput(invoice.createdAt) : "";
    return matchesSearch && (!invoiceStatus || invoice.invoiceStatus === invoiceStatus) && (!paymentStatus || invoice.paymentStatus === paymentStatus) && (!dateFilter || malaysiaDate === dateFilter);
  });

  return (
    <main className="admin-page">
      <Card className="admin-card">
        <div className="admin-page-header"><div><p className="admin-eyebrow">Billing</p><h1>Invoice List</h1><p>Search and manage submitted invoices.</p></div></div>
        {error ? <p className="error">{error}</p> : null}
        <div className="admin-list-filters">
          <input aria-label="Search invoices" placeholder="Search invoice, quotation, customer or company" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Invoice status" value={invoiceStatus} onChange={(event) => setInvoiceStatus(event.target.value)}><option value="">All invoice statuses</option>{["DRAFT","SUBMITTED","PENDING_PAYMENT_REVIEW","PAID","CONFIRMED","CANCELLED"].map((value)=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select>
          <select aria-label="Payment status" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}><option value="">All payment statuses</option>{["UNPAID","RECEIPT_UPLOADED","VERIFIED","REJECTED"].map((value)=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select>
          <input aria-label="Submitted date" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Quotation No.</th>
                <th>Customer</th>
                <th>Event date</th>
                <th>Total</th>
                <th>Payment/status</th>
                <th>Submitted date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((invoice) => {
                const pricing = calculatePricing(invoice.quotation);
                return (
                  <tr key={invoice.invoiceNo}>
                    <td>{invoice.invoiceNo}</td>
                    <td>{invoice.quotation.quotationNo}</td>
                    <td>{invoice.quotation.customer.name}</td>
                    <td>{invoice.quotation.serviceDates[0] ? formatDateLabel(invoice.quotation.serviceDates[0].serviceDate) : "-"}</td>
                    <td>{formatMoney(pricing.total)}</td>
                    <td>{invoice.paymentStatus ?? "RECEIPT_UPLOADED"}<br /><small>{invoice.invoiceStatus ?? "SUBMITTED"}</small></td>
                    <td>{invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString("en-MY", { timeZone: "Asia/Kuala_Lumpur" }) : "-"}</td>
                    <td>
                      <div className="admin-actions"><Link href={`/admin/invoices/${invoice.invoiceNo}`}>View</Link><Link href={`/admin/invoices/${invoice.invoiceNo}/edit`}>Edit</Link></div>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={8}>No invoices match the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
