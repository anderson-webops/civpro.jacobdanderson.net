const SAFE_PROTOCOLS = new Set(["https:", "http:"]);

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

export function safeExternalHref(value, fallback = "#") {
  try {
    const url = new URL(String(value));
    return SAFE_PROTOCOLS.has(url.protocol) ? escapeHtml(url.href) : fallback;
  } catch {
    return fallback;
  }
}

export function safeId(value, fallback = "item") {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return normalized || fallback;
}
