"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "../../../components/common/Card";
import { calculatePricing } from "../../../lib/pricing";
import { loadAllInvoices } from "../../../lib/invoice-storage";
import { formatDateLabel, formatMoney } from "../../../lib/formatters";
import type { InvoiceDetails } from "../../../types/invoice";

export default function AdminInvoiceListPage() {
  const [invoices, setInvoices] = useState<InvoiceDetails[]>([]);

  useEffect(() => {
    setInvoices(loadAllInvoices());
  }, []);

  return (
    <main className="hc-page admin-page">
      <Card className="admin-card">
        <div className="admin-nav">
          <Link href="/admin">Admin Home</Link>
          <Link href="/quotation">Quotation Page</Link>
          <Link href="/invoice">Invoice Page</Link>
          <Link href="/admin/quotations">Quotation List</Link>
        </div>
        <h1>Invoice List</h1>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Quotation No.</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Event date</th>
                <th>Total amount</th>
                <th>Payment status</th>
                <th>Invoice status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const pricing = calculatePricing(invoice.quotation);
                return (
                  <tr key={invoice.invoiceNo}>
                    <td>{invoice.invoiceNo}</td>
                    <td>{invoice.quotation.quotationNo}</td>
                    <td>{invoice.quotation.customer.name}</td>
                    <td>{invoice.quotation.customer.phone}</td>
                    <td>{invoice.quotation.serviceDates[0] ? formatDateLabel(invoice.quotation.serviceDates[0].serviceDate) : "-"}</td>
                    <td>{formatMoney(pricing.total)}</td>
                    <td>{invoice.paymentStatus ?? "RECEIPT_UPLOADED"}</td>
                    <td>{invoice.invoiceStatus ?? "SUBMITTED"}</td>
                    <td>
                      <Link href={`/admin/invoices/${invoice.invoiceNo}`}>View Details</Link>
                    </td>
                  </tr>
                );
              })}
              {!invoices.length ? (
                <tr>
                  <td colSpan={9}>No invoices saved yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
