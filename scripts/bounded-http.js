import { Buffer } from "node:buffer";

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;

export async function fetchBoundedResponse(fetchImpl, url, options = {}, limits = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required.");
  }

  const timeoutMs = positiveInteger(limits.timeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, "timeoutMs");
  const maxResponseBytes = positiveInteger(
    limits.maxResponseBytes,
    DEFAULT_MAX_RESPONSE_BYTES,
    "maxResponseBytes"
  );
  const label = String(limits.label || "HTTP request");
  const controller = new AbortController();
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(boundedHttpError(`${label} timed out after ${timeoutMs} ms.`, "ERR_HTTP_TIMEOUT"));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      fetchImpl(url, { ...options, signal: controller.signal }),
      timeout
    ]);
    const bodyText = await Promise.race([
      readBoundedResponseText(response, maxResponseBytes, label),
      timeout
    ]);
    return { response, bodyText };
  } catch (error) {
    if (error?.boundedHttp === true) throw error;
    const code = safeTransportCode(error);
    throw boundedHttpError(`${label} failed${code ? ` (${code})` : ""}.`, "ERR_HTTP_TRANSPORT");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function readBoundedResponseText(response, maxResponseBytes, label = "HTTP response") {
  const limit = positiveInteger(maxResponseBytes, DEFAULT_MAX_RESPONSE_BYTES, "maxResponseBytes");
  const contentLength = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) {
    throw boundedHttpError(`${label} exceeded the ${limit}-byte response limit.`, "ERR_HTTP_RESPONSE_LIMIT");
  }

  if (response?.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        total += chunk.length;
        if (total > limit) {
          await reader.cancel("response limit exceeded").catch(() => {});
          throw boundedHttpError(`${label} exceeded the ${limit}-byte response limit.`, "ERR_HTTP_RESPONSE_LIMIT");
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock?.();
    }
    return Buffer.concat(chunks, total).toString("utf8");
  }

  if (typeof response?.text !== "function") {
    throw new TypeError(`${label} did not provide a readable response body.`);
  }
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > limit) {
    throw boundedHttpError(`${label} exceeded the ${limit}-byte response limit.`, "ERR_HTTP_RESPONSE_LIMIT");
  }
  return text;
}

function boundedHttpError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.boundedHttp = true;
  return error;
}

function safeTransportCode(error) {
  for (const candidate of [error?.code, error?.cause?.code]) {
    const normalized = String(candidate || "").trim();
    if (/^[A-Z0-9_-]{2,48}$/.test(normalized)) return normalized;
  }
  return "";
}

function positiveInteger(value, fallback, label) {
  const candidate = value == null ? fallback : Number(value);
  if (!Number.isSafeInteger(candidate) || candidate <= 0) {
    throw new TypeError(`${label} must be a positive integer.`);
  }
  return candidate;
}
