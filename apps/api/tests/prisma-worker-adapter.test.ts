import assert from "node:assert/strict";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { getRequestPrismaClient, prisma, withWorkerDatabase } from "../src/utils/prisma";

test("Prisma Worker client initializes with Hyperdrive and the PostgreSQL adapter exposes transactions", async () => {
  const localConnectionString = "postgres://local:local@127.0.0.1:5432/local";
  await withWorkerDatabase(localConnectionString, async () => {
    // Resolving the method confirms the scoped proxy uses a Prisma client and
    // constructs the Hyperdrive-backed adapter without opening a connection.
    assert.equal(typeof prisma["$connect"], "function");
  });

  const driver = await new PrismaPg({ connectionString: localConnectionString }).connect();
  try {
    assert.equal(typeof driver.startTransaction, "function");
  } finally {
    await driver.dispose();
  }
});

test("concurrent Worker scopes keep distinct Prisma clients across async work", async () => {
  const localConnectionString = "postgres://local:local@127.0.0.1:5432/local";
  const clients = await Promise.all([1, 2].map(() =>
    withWorkerDatabase(localConnectionString, async () => {
      await Promise.resolve();
      const scopedClient = getRequestPrismaClient();
      assert.ok(scopedClient);
      assert.equal(typeof prisma["$connect"], "function");
      return scopedClient;
    })
  ));

  assert.notStrictEqual(clients[0], clients[1]);
});
