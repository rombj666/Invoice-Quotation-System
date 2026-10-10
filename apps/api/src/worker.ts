import { httpServerHandler } from "cloudflare:node";
import { app } from "./server";
import { configureWorkerDatabase } from "./utils/prisma";

type WorkerEnvironment = { HYPERDRIVE: { connectionString: string } };

const port = 4000;

const server = app.listen(port);
const httpHandler = httpServerHandler(server);

export default {
  async fetch(request: Request, environment: WorkerEnvironment, context: unknown): Promise<Response> {
    // Bindings are request-scoped in Workers. Configure Prisma before Express dispatches.
    configureWorkerDatabase(environment.HYPERDRIVE.connectionString);
    return httpHandler.fetch(request, environment, context);
  }
};
