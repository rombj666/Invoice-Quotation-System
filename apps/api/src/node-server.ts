import "dotenv/config";
import { app } from "./server";

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  console.log(`Hour Coffee API running on port ${port}`);
});
