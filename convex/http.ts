import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { hashToken } from "./lib/tokens";
import { hostedBootstrap, hostedSecurityHeaders } from "./lib/hostedRuntime";
import { verifyResendWebhook } from "./invitationEmails";

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
  path: "/webhooks/resend",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    const id = request.headers.get("svix-id") ?? "";
    const timestamp = request.headers.get("svix-timestamp") ?? "";
    const signature = request.headers.get("svix-signature") ?? "";
    const payload = await request.text();
    if (!secret || !id || !timestamp || !signature || !await verifyResendWebhook({ payload, id, timestamp, signature, secret }))
      return new Response("Invalid webhook.", { status: 400 });
    let event: {
      type?: string;
      created_at?: string;
      data?: { email_id?: string; bounce?: { message?: string }; reason?: string };
    };
    try { event = JSON.parse(payload); }
    catch { return new Response("Invalid payload.", { status: 400 }); }
    if (!event.type || !event.data?.email_id)
      return new Response("Ignored.", { status: 200 });
    await ctx.runMutation(internal.invitationEmails.recordWebhookEvent, {
      eventId: id,
      eventType: event.type,
      providerEmailId: event.data.email_id,
      occurredAt: event.created_at ? Date.parse(event.created_at) || Date.now() : Date.now(),
      details: event.data.bounce?.message ?? event.data.reason,
    });
    return new Response("OK", { status: 200 });
  }),
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
      const bootstrap = hostedBootstrap(token, deploymentKey, path, `${root}${directory}`);
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
    return new Response(blob, { status: 200, headers: hostedSecurityHeaders(asset.contentType) });
  }),
});

function response(body: BodyInit, status: number, contentType: string) {
  return new Response(body, { status, headers: hostedSecurityHeaders(contentType) });
}

export default http;
