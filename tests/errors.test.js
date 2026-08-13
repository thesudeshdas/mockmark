import test from "node:test";
import assert from "node:assert/strict";
import { cleanError } from "../src/errors.js";

test("prefers safe Convex error data over production request IDs", () => {
  const error = new Error("[Request ID: abc123] Server Error");
  error.data = "Review access is invalid or expired.";
  assert.equal(cleanError(error), "Review access is invalid or expired.");
});

test("falls back to the final nested Convex error", () => {
  const error = new Error(
    "Server Error\nUncaught ConvexError: Request failed.\nUncaught ConvexError: Thread is resolved.",
  );
  assert.equal(cleanError(error), "Thread is resolved.");
});
