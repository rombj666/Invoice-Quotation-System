import { apiBaseUrl } from "./api-client";

export type OrderTodo = {
  code: string;
  message: string;
};

export type CustomerOrder = {
  quotationNo: string;
  status: string;
  createdAt: string;
  firstEventDate: string | null;
  totalAmount: number;
  invoice: {
    invoiceNo: string;
    invoiceStatus: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
    receipt: {
      status: string;
      verificationStatus: string | null;
      verificationNote: string | null;
      uploadedAt: string;
    } | null;
  } | null;
  todos: OrderTodo[];
};

export type CustomerOrdersResult = {
  matched: boolean;
  customer?: { name: string; phone: string; email: string };
  orders: CustomerOrder[];
};

export function loadCustomerOrders(identity: { phone: string; email: string }): Promise<CustomerOrdersResult> {
  return fetch(`${apiBaseUrl}/api/customers/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(identity)
  }).then(async (response) => {
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error ?? "Request failed");
    return payload as CustomerOrdersResult;
  });
}
