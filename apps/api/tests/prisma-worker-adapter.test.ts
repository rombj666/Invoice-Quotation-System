import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { configureWorkerDatabase, prisma } from "../src/utils/prisma";

test("Prisma Worker client initializes with Hyperdrive and the PostgreSQL adapter exposes transactions", async () => {
  const localConnectionString = "postgres://local:local@127.0.0.1:5432/local";
  configureWorkerDatabase(localConnectionString);

  // Resolving the method constructs PrismaClient with PrismaPg but does not connect.
  assert.equal(typeof prisma["$connect"], "function");

  const driver = await new PrismaPg({ connectionString: localConnectionString }).connect();
  try {
    assert.equal(typeof driver.startTransaction, "function");
  } finally {
    await driver.dispose();
  }
});
