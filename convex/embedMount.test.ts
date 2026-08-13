import { describe, expect, test } from "vitest";
import { shouldMountMockmark } from "../src/embed/mount";

describe("host-page mount guard", () => {
  test("mounts a locked shell on deployed pages so members can sign in", () => {
    expect(shouldMountMockmark("app.example.com", "", false)).toBe(true);
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
