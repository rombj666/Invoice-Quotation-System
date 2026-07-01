import cors from "cors";
import "dotenv/config";
import express from "express";
import { invoiceRoutes } from "./routes/invoices";
import { quotationRoutes } from "./routes/quotations";

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hour-coffee-api" });
});

app.use("/api/quotations", quotationRoutes);
app.use("/api/invoices", invoiceRoutes);

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
