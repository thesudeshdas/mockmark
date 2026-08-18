import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { hashToken } from "./lib/tokens";

const http = httpRouter();
auth.addHttpRoutes(http);

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(
    async () =>
      new Response(JSON.stringify({ ok: true, service: "mockmark" }), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      }),
  ),
});

http.route({
  pathPrefix: "/hosted/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const parts = url.pathname.slice("/hosted/".length).split("/");
    const token = decodeURIComponent(parts.shift() ?? "");
    const deploymentKey = decodeURIComponent(parts.shift() ?? "");
    let path = parts.map(decodeURIComponent).join("/");
    if (!path || path.endsWith("/")) path += "index.html";
    if (!token.startsWith("mms_") || !deploymentKey.startsWith("mmb_") || path.split("/").some((part) => !part || part === "." || part === ".."))
      return response("Not found.", 404, "text/plain; charset=utf-8");
    const asset = await ctx.runQuery(internal.deployments.resolveHostedAsset, {
      tokenHash: await hashToken(token),
      deploymentKey,
      path,
    });
    if (!asset) return response("Mock unavailable. Open the original share URL and sign in again.", 401, "text/plain; charset=utf-8");
    const blob = await ctx.storage.get(asset.storageId);
    if (!blob) return response("Not found.", 404, "text/plain; charset=utf-8");
    if (asset.contentType === "text/html") {
      const root = `/hosted/${encodeURIComponent(token)}/${encodeURIComponent(deploymentKey)}/`;
      const directory = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
      const html = (await blob.text()).replace(/((?:src|href|action)=["'])\/(?!\/)/gi, `$1${root}`);
      const bootstrap = `<base href="${root}${directory}"><script>window.__MOCKMARK_HOSTED_TOKEN__=${JSON.stringify(token)};</script>`;
      const hydrated = /<head([^>]*)>/i.test(html)
        ? html.replace(/<head([^>]*)>/i, `<head$1>${bootstrap}`)
        : `${bootstrap}${html}`;
      return response(hydrated, 200, asset.contentType);
    }
    if (asset.contentType.startsWith("text/css")) {
      const root = `/hosted/${encodeURIComponent(token)}/${encodeURIComponent(deploymentKey)}/`;
      const css = (await blob.text()).replace(/url\((['"]?)\/(?!\/)/gi, `url($1${root}`);
      return response(css, 200, asset.contentType);
    }
    return new Response(blob, { status: 200, headers: secureHeaders(asset.contentType) });
  }),
});

function response(body: BodyInit, status: number, contentType: string) {
  return new Response(body, { status, headers: secureHeaders(contentType) });
}

function secureHeaders(contentType: string) {
  return {
    "content-type": contentType,
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "access-control-allow-origin": "*",
    "content-security-policy": "sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-top-navigation-by-user-activation",
  };
}

export default http;
