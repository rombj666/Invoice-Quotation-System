import cors from "cors";
import "dotenv/config";
import express from "express";
import { adminProductAvailabilityRoutes } from "./routes/admin-product-availability";
import { fileRoutes } from "./routes/files";
import { invoiceRoutes } from "./routes/invoices";
import { quotationRoutes } from "./routes/quotations";
import { quotationTrackingRoutes } from "./routes/quotation-tracking";
import { adminLockedDateRoutes, lockedDateRoutes } from "./routes/locked-dates";
import { adminDashboardRoutes } from "./routes/admin-dashboard";
import { adminRecordRoutes } from "./routes/admin-records";
import { adminQuotationExtraChargeRoutes } from "./routes/admin-quotation-extra-charges";
import { adminBeverageRoutes, beverageRoutes } from "./routes/beverages";
import { adminPackageRoutes, packageRoutes } from "./routes/packages";

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hour-coffee-api" });
});

app.use("/api/quotations", quotationRoutes);
app.use("/api/quotation-tracking", quotationTrackingRoutes);
app.use("/api/locked-dates", lockedDateRoutes);
app.use("/api/beverages", beverageRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/admin/product-availability", adminProductAvailabilityRoutes);
app.use("/api/admin/packages", adminPackageRoutes);
app.use("/api/admin/beverages", adminBeverageRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/lock-dates", adminLockedDateRoutes);
app.use("/api/admin/quotations", adminQuotationExtraChargeRoutes);
app.use("/api/admin", adminRecordRoutes);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error && typeof error === "object" && "type" in error && error.type === "entity.too.large") {
    return res.status(413).json({ error: "Upload is too large. Please use smaller image files and try again." });
  }
  if (error && typeof error === "object" && "statusCode" in error && typeof error.statusCode === "number") {
    return res.status(error.statusCode).json({ error: error instanceof Error ? error.message : "Request failed" });
  }
  res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Hour Coffee API running on port ${port}`);
});
