import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { cloudinaryFolders, deleteCloudinaryPdf, uploadCloudinaryBuffer } from "../services/cloudinary.service";
import { parseMultipartRequest } from "../utils/multipart";
import { calculateQuotationPricing } from "../utils/pricing";
import { prisma } from "../utils/prisma";
import { toQuotationPayload } from "./quotations";

export const adminQuotationExtraChargeRoutes = Router();

type MutationKind = "create" | "update" | "delete";

type ChargeInput = {
  title: string;
  description: string | null;
  amount: Prisma.Decimal;
};

function metadataObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function validateChargeInput(value: any): { charge?: ChargeInput; error?: string } {
  const title = String(value?.title ?? "").trim();
  const description = String(value?.description ?? "").trim() || null;
  const amountText = String(value?.amount ?? "").trim();

  if (!title) return { error: "Charge title is required." };
  if (title.toLowerCase() === "extra serving hour") return { error: "Extra Serving Hour is calculated automatically and cannot be added manually." };
  if (!amountText) return { error: "Charge amount is required." };
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountText)) return { error: "Charge amount must be greater than RM0 and use no more than two decimal places." };

  const amount = new Prisma.Decimal(amountText);
  if (amount.lessThanOrEqualTo(0)) return { error: "Charge amount must be greater than RM0." };
  if (amount.greaterThan(new Prisma.Decimal("99999999.99"))) return { error: "Charge amount is too large." };

  return { charge: { title, description, amount } };
}

function money(value: Prisma.Decimal): string {
  return Number(value).toFixed(2);
}

async function mutateExtraCharge(kind: MutationKind, req: Request, res: Response, next: NextFunction) {
  let newPdfPublicId: string | undefined;
  try {
    const multipart = await parseMultipartRequest(req, 30 * 1024 * 1024);
    const payload = JSON.parse(multipart.fields.payload ?? "{}");
    const pdfFile = multipart.files.find((file) => file.fieldName === "quotationPdf");
    if (!pdfFile || pdfFile.mimeType !== "application/pdf" || pdfFile.buffer.length === 0) {
      return res.status(400).json({ error: "A regenerated quotation PDF is required." });
    }
    const quotationId = Array.isArray(req.params.quotationId) ? req.params.quotationId[0] : req.params.quotationId;
    const chargeId = Array.isArray(req.params.chargeId) ? req.params.chargeId[0] : req.params.chargeId;

    const current = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: {
        extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } },
        invoices: { select: { id: true } }
      }
    });
    if (!current) return res.status(404).json({ error: "Quotation not found." });

    const existingCharge = chargeId
      ? current.extraCharges.find((charge) => charge.id === chargeId)
      : undefined;
    if (kind !== "create" && !existingCharge) {
      return res.status(404).json({ error: "Extra charge not found for this quotation." });
    }

    const validated = kind === "delete" ? {} : validateChargeInput(payload);
    if (validated.error) return res.status(400).json({ error: validated.error });

    const pdfUpload = await uploadCloudinaryBuffer(
      pdfFile,
      cloudinaryFolders.quotationPdfs,
      `${current.quotationNo}-${Date.now()}.pdf`
    );
    if (!pdfUpload) return res.status(502).json({ error: "Unable to upload the regenerated quotation PDF." });
    newPdfPublicId = pdfUpload.cloudinaryPublicId;

    const updated = await prisma.$transaction(async (tx) => {
      let auditSummary: string;

      if (kind === "create") {
        const charge = validated.charge as ChargeInput;
        await tx.quotationExtraCharge.create({
          data: { quotationId: current.id, ...charge }
        });
        auditSummary = `Added extra charge "${charge.title}" - RM${money(charge.amount)}.`;
      } else if (kind === "update") {
        const charge = validated.charge as ChargeInput;
        await tx.quotationExtraCharge.update({
          where: { id: existingCharge!.id },
          data: charge
        });
        auditSummary = `Updated extra charge "${existingCharge!.title}" from RM${money(existingCharge!.amount)} to RM${money(charge.amount)}.`;
      } else {
        await tx.quotationExtraCharge.delete({ where: { id: existingCharge!.id } });
        auditSummary = `Deleted extra charge "${existingCharge!.title}" - RM${money(existingCharge!.amount)}.`;
      }

      const extraCharges = await tx.quotationExtraCharge.findMany({
        where: { quotationId: current.id },
        orderBy: { createdAt: "asc" }
      });
      const storedMetadata = metadataObject(current.metadata);
      const pricing = calculateQuotationPricing(
        { ...storedMetadata, discountPercent: Number(current.discountPercent) } as any,
        extraCharges
      );
      const metadata = {
        ...storedMetadata,
        extraCharges: undefined,
        pricingSnapshot: {
          subtotal: pricing.subtotal,
          discountAmount: pricing.discountAmount,
          total: pricing.total
        }
      };

      return tx.quotation.update({
        where: { id: current.id },
        data: {
          subtotalAmount: pricing.subtotal,
          discountAmount: pricing.discountAmount,
          totalAmount: pricing.total,
          quotationPdfUrl: pdfUpload.fileUrl,
          quotationPdfPublicId: pdfUpload.cloudinaryPublicId,
          metadata: toJsonValue(metadata),
          statusHistory: {
            create: {
              fromStatus: current.status,
              toStatus: current.status,
              changedBy: "admin",
              changeSummary: auditSummary
            }
          }
        },
        include: {
          extraCharges: { orderBy: { createdAt: "asc" }, include: { dates: { include: { quotationDate: true } } } },
          invoices: { select: { id: true } },
          statusHistory: { orderBy: { createdAt: "desc" } }
        }
      });
    });

    newPdfPublicId = undefined;
    if (current.quotationPdfPublicId && current.quotationPdfPublicId !== updated.quotationPdfPublicId) {
      void deleteCloudinaryPdf(current.quotationPdfPublicId).catch((error) => {
        console.error("Unable to delete replaced quotation PDF.", {
          quotationId: current.id,
          publicId: current.quotationPdfPublicId,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      });
    }

    res.json(toQuotationPayload(updated));
  } catch (error) {
    if (newPdfPublicId) {
      await deleteCloudinaryPdf(newPdfPublicId).catch(() => undefined);
    }
    next(error);
  }
}

adminQuotationExtraChargeRoutes.post("/:quotationId/extra-charges", (req, res, next) => {
  void mutateExtraCharge("create", req, res, next);
});

adminQuotationExtraChargeRoutes.patch("/:quotationId/extra-charges/:chargeId", (req, res, next) => {
  void mutateExtraCharge("update", req, res, next);
});

adminQuotationExtraChargeRoutes.delete("/:quotationId/extra-charges/:chargeId", (req, res, next) => {
  void mutateExtraCharge("delete", req, res, next);
});
