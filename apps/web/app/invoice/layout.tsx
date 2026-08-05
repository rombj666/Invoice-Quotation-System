import type { ReactNode } from "react";
import { ContactUsButton } from "../../components/common/ContactUsButton";

export default function InvoiceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="customer-flow">
      {children}
      <ContactUsButton />
    </div>
  );
}
