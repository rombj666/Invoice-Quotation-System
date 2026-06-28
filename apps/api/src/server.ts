import cors from "cors";
import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "hour-coffee-api" });
});

app.listen(port, () => {
  console.log(`Hour Coffee API running on port ${port}`);
});
