import test from "node:test";
import assert from "node:assert/strict";
import { validateProjectKey, validateUrl } from "../src/config.js";

test("validates public project keys", () => {
  const key = `mmp_${"a".repeat(36)}`;
  assert.equal(validateProjectKey(key), key);
  assert.throws(() => validateProjectKey("mmp_short"));
  assert.throws(() => validateProjectKey("mmi_" + "a".repeat(36)));
});

test("allows only HTTP(S) service URLs", () => {
  assert.equal(validateUrl("https://example.com/path", "URL"), "https://example.com");
  assert.equal(validateUrl("http://127.0.0.1:3210", "URL"), "http://127.0.0.1:3210");
  assert.throws(() => validateUrl("file:///tmp/mockmark", "URL"));
});
