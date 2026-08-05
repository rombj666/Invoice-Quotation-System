"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const navigation = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/quotations", label: "Quotation List" },
  { href: "/admin/invoices", label: "Invoice List" },
  { href: "/admin/product-availability", label: "Product Availability" }
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="admin-shell">
      <button className="admin-menu-button" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="admin-sidebar">
        <span aria-hidden="true">☰</span> Menu
      </button>
      {open ? <button className="admin-sidebar-backdrop" type="button" aria-label="Close admin menu" onClick={() => setOpen(false)} /> : null}
      <aside className={`admin-sidebar ${open ? "open" : ""}`} id="admin-sidebar">
        <div className="admin-sidebar-brand">Hour Coffee Admin</div>
        <nav aria-label="Admin navigation">
          {navigation.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return <Link className={active ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>;
          })}
        </nav>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
