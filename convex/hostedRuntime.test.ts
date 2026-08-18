import { describe, expect, test } from "vitest";
import { hostedBootstrap, hostedPageIdentity, hostedSecurityHeaders } from "./lib/hostedRuntime";

describe("hosted response runtime", () => {
  test("bootstraps one stable page identity without exposing it to session storage", () => {
    const html = hostedBootstrap("mms_session", "mmb_build", "mocks/landing.html", "/hosted/mms_session/mmb_build/mocks/");
    expect(html).toContain('window.__MOCKMARK_HOSTED_TOKEN__="mms_session"');
    expect(html).toContain('window.__MOCKMARK_HOSTED_PAGE_KEY__="hosted:mmb_build:mocks/landing.html"');
    expect(hostedPageIdentity("mmb_build", "mocks/landing.html")).not.toContain("mms_");
  });

  test("keeps hosted documents in an opaque-origin sandbox", () => {
    const csp = hostedSecurityHeaders("text/html")["content-security-policy"];
    expect(csp).toContain("sandbox allow-scripts");
    expect(csp).not.toContain("allow-same-origin");
  });
});
