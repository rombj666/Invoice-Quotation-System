import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(process.cwd(), "../..");
const read = (...parts: string[]) => readFileSync(join(root, ...parts), "utf8");

test("follow-up fields, routes, and frontend page are removed while operational statuses remain", () => {
  const schema = read("prisma", "schema.prisma");
  const adminRoutes = read("apps", "api", "src", "routes", "admin-records.ts");
  const quotationTypes = read("apps", "web", "types", "quotation.ts");
  assert.doesNotMatch(schema, /FollowUpStatus|followUpStatus|followUpNote|lastFollowedUpAt/);
  assert.doesNotMatch(adminRoutes, /follow.?up/i);
  assert.doesNotMatch(quotationTypes, /follow.?up/i);
  assert.equal(existsSync(join(root, "apps", "web", "app", "quotation", "contacted", "page.tsx")), false);
  assert.match(schema, /PENDING_APPROVAL/);
  assert.match(schema, /enum InvoiceStatus/);
  assert.match(schema, /enum PaymentStatus/);
});

test("daily public visitor uniqueness and public-only beverage filtering are database-backed", () => {
  const schema = read("prisma", "schema.prisma");
  const analytics = read("apps", "api", "src", "routes", "quotation-analytics.ts");
  const beverages = read("apps", "api", "src", "routes", "beverages.ts");
  assert.match(schema, /@@unique\(\[anonymousVisitorId, visitDate, pagePath\]\)/);
  assert.match(analytics, /pagePath === "\/quotation"/);
  assert.match(analytics, /isLocalRequest/);
  assert.match(beverages, /where: \{ isAvailable: true, isArchived: false \}/);
});

test("invoice creation ignores browser quotation data and copies saved beverage snapshots", () => {
  const invoices = read("apps", "api", "src", "routes", "invoices.ts");
  assert.match(invoices, /data\.quotation = savedQuotation/);
  assert.match(invoices, /drinkSnapshots:/);
  assert.match(invoices, /itemType: "EXTRA_SERVING_HOUR"/);
});
