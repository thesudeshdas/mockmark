import { describe, expect, test } from "vitest";
import {
  clearSessionToken,
  pageIdentity,
  readSessionToken,
  writeSessionToken,
} from "./runtime";

const blockedStorage = () => {
  throw new DOMException(
    "The document is sandboxed and lacks the 'allow-same-origin' flag.",
    "SecurityError",
  );
};

describe("hosted embed runtime", () => {
  test("tolerates session storage blocked by an opaque sandbox", () => {
    expect(readSessionToken("mmp_project", blockedStorage)).toBe("");
    expect(() => writeSessionToken("mmp_project", "mms_session", blockedStorage)).not.toThrow();
    expect(() => clearSessionToken("mmp_project", blockedStorage)).not.toThrow();
  });

  test("keeps page identity stable across member preview sessions", () => {
    const hostedIdentity = "hosted:mmb_build:mocks/landing.html";
    expect(pageIdentity("blissful-cow.convex.site", "/hosted/mms_first/mmb_build/mocks/landing.html", hostedIdentity)).toBe(hostedIdentity);
    expect(pageIdentity("blissful-cow.convex.site", "/hosted/mms_second/mmb_build/mocks/landing.html", hostedIdentity)).toBe(hostedIdentity);
    expect(hostedIdentity).not.toContain("mms_");
  });
});
