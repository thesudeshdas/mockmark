import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { httpAction } from "./_generated/server";

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

export default http;
