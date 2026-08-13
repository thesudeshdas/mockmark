import { describe, expect, test } from "vitest";
import { shouldMountMockmark } from "../src/embed/mount";

describe("host-page mount guard", () => {
  test("stays invisible on deployed pages without review access", () => {
    expect(shouldMountMockmark("app.example.com", "", false)).toBe(false);
  });

  test("mounts for local development and authorized review links", () => {
    expect(shouldMountMockmark("localhost", "", false)).toBe(true);
    expect(
      shouldMountMockmark(
        "preview.example.com",
        "?mockmark_token=mmr_example",
        false,
      ),
    ).toBe(true);
    expect(shouldMountMockmark("preview.example.com", "", true)).toBe(true);
  });
});
