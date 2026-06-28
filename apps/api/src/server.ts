import cors from "cors";
import "dotenv/config";
import express from "express";
import { invoiceRoutes } from "./routes/invoices";
import { quotationRoutes } from "./routes/quotations";

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hour-coffee-api" });
});

app.use("/api/quotations", quotationRoutes);
app.use("/api/invoices", invoiceRoutes);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Hour Coffee API running on port ${port}`);
});
