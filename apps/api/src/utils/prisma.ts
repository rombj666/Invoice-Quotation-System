import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

type PrismaAdapterOptions = ConstructorParameters<typeof PrismaPg>[0];

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let workerConnectionString: string | undefined;

/** Configure the Worker database adapter before the first database query. */
export function configureWorkerDatabase(connectionString: string): void {
  workerConnectionString = connectionString;
}

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const adapterOptions: PrismaAdapterOptions | undefined = workerConnectionString
    ? { connectionString: workerConnectionString }
    : undefined;
  const adapter = adapterOptions ? new PrismaPg(adapterOptions) : undefined;
  const client = new PrismaClient({
    ...(adapter ? { adapter } : {}),
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
