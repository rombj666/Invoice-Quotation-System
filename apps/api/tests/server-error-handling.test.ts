import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { apiErrorHandler } from "../src/server";

function invokeErrorHandler(error: unknown) {
  let status = 200;
  let body: unknown;
  const response = {
    status(code: number) {
      status = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    }
  } as unknown as Response;

  apiErrorHandler(error, {} as Request, response, () => undefined);
  return { status, body };
}

test("database failures return an opaque 500 and emit only a sanitized log", () => {
  const originalConsoleError = console.error;
  const logged: unknown[][] = [];
  console.error = (...values: unknown[]) => logged.push(values);
  try {
    const result = invokeErrorHandler(new Error("SQLSTATE secret-value postgres://private/db"));
    assert.deepEqual(result, { status: 500, body: { error: "Unexpected server error" } });
    assert.deepEqual(logged, [["Unhandled API request error."]]);
  } finally {
    console.error = originalConsoleError;
  }
});

test("client errors keep their existing status and message", () => {
  const result = invokeErrorHandler(Object.assign(new Error("Invalid request"), { statusCode: 400 }));
  assert.deepEqual(result, { status: 400, body: { error: "Invalid request" } });
});
