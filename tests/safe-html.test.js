import fs from "node:fs";
import { escapeHtml, safeExternalHref, safeId } from "../public/safe-html.js";

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const malicious = `<img src=x onerror="globalThis.compromised=true"><script>alert('x')</script>`;
const escaped = escapeHtml(malicious);
expect(!escaped.includes("<img") && !escaped.includes("<script"), "Malicious markup should not survive HTML escaping.");
expect(escaped.includes("&lt;img") && escaped.includes("&quot;"), "Escaping should encode tags and attribute quotes.");
expect(safeExternalHref("javascript:alert(1)") === "#", "Unsafe URL protocols should be rejected.");
expect(safeExternalHref("data:text/html,<script>x</script>") === "#", "Data URLs should be rejected.");
expect(safeExternalHref("https://uscode.house.gov/view.xhtml?x=1&amp=2").startsWith("https://"), "HTTPS authority URLs should be preserved safely.");
expect(safeId(`Guide ${malicious}`) === "guide-img-src-x-onerror-globalthis-compromised-true-script-alert-x-script", "Generated DOM ids should contain only safe characters.");

const app = fs.readFileSync("public/app.js", "utf8");
expect(app.includes('from "./safe-html.js"'), "The main application should use the centralized escaping layer.");
expect(!app.includes("function escapeHtml("), "The main application should not maintain a second escaping implementation.");
expect(app.includes("safeExternalHref(source.officialHref || source.href)"), "Authority links should pass through URL validation.");

if (failures.length) {
  console.error("Safe HTML tests failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Safe HTML tests passed.");
}
