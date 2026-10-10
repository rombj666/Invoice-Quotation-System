import { httpServerHandler } from "cloudflare:node";
import { app } from "./server";
import { configureWorkerDatabase, prisma } from "./utils/prisma";

type WorkerEnvironment = {
  HYPERDRIVE: { connectionString: string };
  DB_DIAGNOSTIC_TOKEN?: string;
};

const port = 4000;

const server = app.listen(port);
const httpHandler = httpServerHandler(server);

const diagnosticPath = "/__internal/db-check";

async function equalToken(candidate: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [candidateHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  const left = new Uint8Array(candidateHash);
  const right = new Uint8Array(expectedHash);
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index++) {
    difference |= left[index] ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function diagnosticResponse(body: { ok: boolean }, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export default {
  async fetch(request: Request, environment: WorkerEnvironment, context: unknown): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === diagnosticPath) {
      if (request.method !== "POST" || !environment.DB_DIAGNOSTIC_TOKEN) {
        return diagnosticResponse({ ok: false }, 404);
      }

      const authorization = request.headers.get("Authorization") ?? "";
      const candidate = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      if (!candidate || !(await equalToken(candidate, environment.DB_DIAGNOSTIC_TOKEN))) {
        return diagnosticResponse({ ok: false }, 404);
      }

      configureWorkerDatabase(environment.HYPERDRIVE.connectionString);
      try {
        await prisma.$queryRawUnsafe("SELECT 1");
        return diagnosticResponse({ ok: true });
      } catch {
        // Deliberately do not expose driver, database, or connection details.
        return diagnosticResponse({ ok: false }, 503);
      }
    }

    // Bindings are request-scoped in Workers. Configure Prisma before Express dispatches.
    configureWorkerDatabase(environment.HYPERDRIVE.connectionString);
    return httpHandler.fetch(request, environment, context);
  }
};
