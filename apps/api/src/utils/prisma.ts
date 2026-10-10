import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const requestPrisma = new AsyncLocalStorage<PrismaClient>();

/**
 * Run a Worker request with its own Prisma client and pg pool. Hyperdrive keeps
 * the origin connection pool warm, while Worker-side clients must not cross
 * invocation boundaries.
 */
export function withWorkerDatabase<T>(connectionString: string, handler: () => T): T {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  return requestPrisma.run(client, handler);
}

/** Exposes the active Worker scope for lifecycle tests and internal diagnostics. */
export function getRequestPrismaClient(): PrismaClient | undefined {
  return requestPrisma.getStore();
}

function getPrismaClient(): PrismaClient {
  const requestClient = requestPrisma.getStore();
  if (requestClient) return requestClient;

  // Railway runs in a conventional long-lived Node.js process, where sharing
  // one Prisma client and pool is the intended lifecycle.
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const client = new PrismaClient({
    log: ["error", "warn"]
  });
  globalForPrisma.prisma = client;
  return client;
}

// Routes keep using the same PrismaClient-shaped API in both Railway/Node and Workers.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  }
});
