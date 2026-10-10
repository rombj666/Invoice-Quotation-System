import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteCloudinaryImage,
  deleteCloudinaryPdf,
  uploadCloudinaryBuffer,
  uploadCloudinaryDataUrl
} from "../src/services/cloudinary.service";

const originalFetch = globalThis.fetch;
const apiSecretForTest = "isolated-test-secret";

function configureTestCredentials() {
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-api-key";
  process.env.CLOUDINARY_API_SECRET = apiSecretForTest;
}

async function expectedSignature(parameters: Record<string, string>) {
  const canonical = Object.entries(parameters).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("&") + apiSecretForTest;
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

test("Cloudinary image and PDF uploads preserve multipart fields and resource types", async () => {
  configureTestCredentials();
  const originalNow = Date.now;
  Date.now = () => 1_700_000_000_000;
  const calls: Array<{ url: string; form: FormData }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), form: init?.body as FormData });
    return Response.json({ secure_url: "https://res.cloudinary.com/test/file", public_id: "hour-coffee/test" });
  }) as typeof fetch;

  try {
    const image = await uploadCloudinaryBuffer({ fieldName: "image", fileName: "cup.png", mimeType: "image/png", buffer: new Uint8Array([1, 2, 3]) }, "hour-coffee/beverages", "cup.png");
    const pdf = await uploadCloudinaryDataUrl("data:application/pdf;base64,JVBERg==", "hour-coffee/invoice-pdfs", "invoice.pdf");
    assert.equal(image?.mimeType, "image/png");
    assert.equal(pdf?.mimeType, "application/pdf");
    assert.match(calls[0].url, /\/image\/upload$/);
    assert.match(calls[1].url, /\/raw\/upload$/);
    assert.equal(calls[0].form.get("api_key"), "test-api-key");
    assert.equal(calls[0].form.get("signature"), await expectedSignature({ folder: "hour-coffee/beverages", public_id: "cup", timestamp: "1700000000" }));
    assert.equal(calls[0].form.get("file") instanceof Blob, true);
    assert.equal(calls[1].form.get("public_id"), "invoice.pdf");
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("Cloudinary deletion signs image and raw PDF requests and reports provider failures", async () => {
  configureTestCredentials();
  const originalNow = Date.now;
  Date.now = () => 1_700_000_000_000;
  const calls: Array<{ url: string; form: FormData }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), form: init?.body as FormData });
    return Response.json({ result: "ok" });
  }) as typeof fetch;

  try {
    await deleteCloudinaryImage("hour-coffee/photo");
    await deleteCloudinaryPdf("hour-coffee/invoice.pdf");
    assert.match(calls[0].url, /\/image\/destroy$/);
    assert.match(calls[1].url, /\/raw\/destroy$/);
    assert.equal(calls[0].form.get("invalidate"), "true");
    assert.equal(calls[0].form.get("signature"), await expectedSignature({ public_id: "hour-coffee/photo", timestamp: "1700000000", invalidate: "true" }));

    globalThis.fetch = (async () => Response.json({ error: { message: "rejected by test mock" } }, { status: 401 })) as typeof fetch;
    await assert.rejects(deleteCloudinaryImage("hour-coffee/photo"), /Unable to delete Cloudinary asset/);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});
