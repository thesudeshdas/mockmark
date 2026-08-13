import { describe, expect, test } from "vitest";
import { shouldMountMockmark } from "../src/embed/mount";

describe("host-page mount guard", () => {
  test("mounts a locked shell on deployed pages so members can sign in", () => {
    expect(shouldMountMockmark("app.example.com", "", false)).toBe(true);
  });

  test("mounts for local and deployed project pages", () => {
    expect(shouldMountMockmark("localhost", "", false)).toBe(true);
    expect(shouldMountMockmark("preview.example.com", "", true)).toBe(true);
  });
});
