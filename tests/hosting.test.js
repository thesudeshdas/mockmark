import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("allows only same-origin dashboard framing of hosted previews", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const catchAll = config.headers.find((rule) => rule.source === "/(.*)");
  const csp = catchAll.headers.find((header) => header.key === "Content-Security-Policy").value;
  assert.match(csp, /frame-src 'self' https:\/\/blissful-cow-156\.convex\.site/);
  assert.match(csp, /frame-ancestors 'self'/);
  assert.doesNotMatch(csp, /frame-ancestors 'none'/);
});
