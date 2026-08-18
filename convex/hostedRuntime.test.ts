import { describe, expect, test } from "vitest";
import { hostedBootstrap, hostedPageIdentity, hostedSecurityHeaders } from "./lib/hostedRuntime";

describe("hosted response runtime", () => {
  test("bootstraps one stable page identity without exposing it to session storage", () => {
    const html = hostedBootstrap("mms_session", "mmb_build", "mocks/landing.html", "/hosted/mms_session/mmb_build/mocks/");
    expect(html).toContain('window.__MOCKMARK_HOSTED_TOKEN__="mms_session"');
    expect(html).toContain('window.__MOCKMARK_HOSTED_PAGE_KEY__="hosted:mocks/landing.html"');
    expect(hostedPageIdentity("mocks/landing.html")).toBe(hostedPageIdentity("mocks/landing.html"));
  });

  test("keeps hosted documents in an opaque-origin sandbox", () => {
    const headers = hostedSecurityHeaders("text/html");
    const csp = headers["content-security-policy"];
    expect(csp).toContain("sandbox allow-scripts");
    expect(csp).not.toContain("allow-same-origin");
    expect(csp).toContain("frame-ancestors https://mockmark.vercel.app");
    expect(headers).not.toHaveProperty("x-frame-options");
  });
});
