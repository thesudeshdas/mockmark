import test from "node:test";
import assert from "node:assert/strict";
import { injectHtml, removeInjection } from "../src/html.js";

const config = { projectKey: `mmp_${"a".repeat(36)}`, convexUrl: "https://example.convex.cloud", appUrl: "https://mockmark.example" };

test("injects one hosted loader and can uninstall cleanly", () => {
  const original = "<!doctype html><html><body><h1>Mock</h1></body></html>";
  const injected = injectHtml(original, config);
  assert.match(injected, /mockmark:start/);
  assert.match(injected, /data-project="mmp_a+/);
  assert.equal(injectHtml(injected, config), injected);
  assert.equal(removeInjection(injected).replace(/\s+/g, ""), original.replace(/\s+/g, ""));
});

test("escapes loader attributes", () => {
  const injected = injectHtml("<body></body>", { ...config, appUrl: "https://example.com/?x=1&y=2" });
  assert.match(injected, /&amp;/);
});
