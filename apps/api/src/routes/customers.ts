import { Router } from "express";
import { prisma } from "../utils/prisma";

export const customerRoutes = Router();

function normalizePhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("60") ? `0${digits.slice(2)}` : digits;
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

type OrderTodo = {
  code: string;
  message: string;
};

function buildTodos(quotation: any): OrderTodo[] {
  return quotation.status === "PENDING_APPROVAL"
    ? [{ code: "QUOTATION_PENDING_APPROVAL", message: "Your quotation is awaiting admin review." }]
    : [];
}

// Customer "My Orders": one phone number (or email) shows every quotation /
// invoice / receipt the customer has, plus quotation actions.
customerRoutes.post("/orders", async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const email = normalizeEmail(req.body?.email);
    if (!phone && !email) {
      return res.status(400).json({ error: "Enter your phone number or email to view your orders." });
    }
    const where = {
      ...(phone && email
        ? { OR: [{ phone }, { email }] }
        : phone
          ? { phone }
          : { email })
    };
    const customers = await prisma.customer.findMany({ where });
    if (!customers.length) return res.json({ matched: false, orders: [] });

    const quotations = await prisma.quotation.findMany({
      where: { customerId: { in: customers.map((customer) => customer.id) } },
      orderBy: { createdAt: "desc" },
      include: {
        dates: { orderBy: { serviceDate: "asc" }, take: 1 },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { paymentReceipts: { orderBy: { uploadedAt: "desc" }, take: 1 } }
        }
      }
    });

    res.json({
      matched: quotations.length > 0,
      customer: {
        name: customers[0].name,
        phone: customers[0].phone,
        email: customers[0].email
      },
      orders: quotations.map((quotation) => {
        const invoice = quotation.invoices[0] ?? null;
        const receipt = invoice?.paymentReceipts?.[0] ?? null;
        const quotationTotal = Number(quotation.totalAmount ?? 0);
        return {
          quotationNo: quotation.quotationNo,
          status: quotation.status,
          createdAt: quotation.createdAt.toISOString(),
          firstEventDate: quotation.dates[0]?.serviceDate.toISOString().slice(0, 10) ?? null,
          totalAmount: quotationTotal,
          invoice: invoice
            ? {
                invoiceNo: invoice.invoiceNo,
                invoiceStatus: invoice.status,
                paymentStatus: invoice.paymentStatus,
                totalAmount: Number(invoice.finalTotalAmount ?? 0),
                createdAt: invoice.createdAt.toISOString(),
                receipt: receipt
                  ? {
                      status: receipt.status,
                      verificationStatus: receipt.verificationStatus ?? null,
                      verificationNote: receipt.verificationNote ?? null,
                      uploadedAt: receipt.uploadedAt.toISOString()
                    }
                  : null
              }
            : null,
          todos: buildTodos(quotation)
        };
      })
    });
  } catch (error) {
    next(error);
  }
});
