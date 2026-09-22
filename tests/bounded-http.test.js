import { fetchBoundedResponse } from "../scripts/bounded-http.js";

const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const normal = await fetchBoundedResponse(
  async () => new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" }
  }),
  "https://example.invalid/test",
  {},
  { label: "bounded test", timeoutMs: 1_000, maxResponseBytes: 128 }
);
expect(JSON.parse(normal.bodyText).ok === true, "Bounded HTTP should preserve a normal response body.");

try {
  await fetchBoundedResponse(
    async () => new Response("x".repeat(65)),
    "https://example.invalid/oversized",
    {},
    { label: "oversized test", timeoutMs: 1_000, maxResponseBytes: 64 }
  );
  expect(false, "Bounded HTTP should reject an oversized streamed response.");
} catch (error) {
  expect(String(error.message).includes("64-byte response limit"), "Oversized response error should identify the enforced limit.");
}

try {
  await fetchBoundedResponse(
    async () => new Response("small", { headers: { "content-length": "1000" } }),
    "https://example.invalid/content-length",
    {},
    { label: "content-length test", timeoutMs: 1_000, maxResponseBytes: 64 }
  );
  expect(false, "Bounded HTTP should reject an oversized declared content length.");
} catch (error) {
  expect(String(error.message).includes("64-byte response limit"), "Content-Length rejection should identify the enforced limit.");
}

let timeoutSignal;
try {
  await fetchBoundedResponse(
    async (_url, options) => {
      timeoutSignal = options.signal;
      return new Promise(() => {});
    },
    "https://example.invalid/timeout",
    {},
    { label: "timeout test", timeoutMs: 10, maxResponseBytes: 64 }
  );
  expect(false, "Bounded HTTP should reject a request that never settles.");
} catch (error) {
  expect(String(error.message).includes("timed out after 10 ms"), "Timeout error should identify the enforced deadline.");
  expect(timeoutSignal?.aborted === true, "Timeout should abort the underlying request signal.");
}

try {
  await fetchBoundedResponse(
    async () => {
      const error = new Error("request failed for https://provider.invalid/?api_key=private-test-key");
      error.code = "ENOTFOUND";
      throw error;
    },
    "https://example.invalid/redaction",
    {},
    { label: "redaction test", timeoutMs: 1_000, maxResponseBytes: 64 }
  );
  expect(false, "Bounded HTTP should report transport failures.");
} catch (error) {
  expect(String(error.message).includes("ENOTFOUND"), "Transport failure should retain a safe diagnostic code.");
  expect(!String(error.message).includes("private-test-key"), "Transport failure should not retain credential-bearing exception text.");
}

if (failures.length) {
  console.error("Bounded HTTP tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Bounded HTTP tests passed.");
