import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { JsonAnnotationStore } from "./store.js";

const MIME = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".webp":"image/webp", ".svg":"image/svg+xml" };
function send(res, status, body, headers={}) { res.writeHead(status, { "content-type":"application/json; charset=utf-8", ...headers }); res.end(JSON.stringify(body)); }
async function readJson(req) { const chunks=[]; for await (const c of req) chunks.push(c); return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }
function safePath(root, pathname) { const decoded = decodeURIComponent(pathname).replace(/^\/+/, ""); const target = resolve(root, normalize(decoded || "index.html")); if (!target.startsWith(resolve(root))) return null; return target; }
export function createServer({ mockDir, dataFile, base = "/" }) {
  const store = new JsonAnnotationStore(dataFile);
  return createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/mockmark/")) {
        res.setHeader("access-control-allow-origin", "*"); res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS"); res.setHeader("access-control-allow-headers", "content-type");
        if (req.method === "OPTIONS") return res.end();
        if (req.method === "GET" && url.pathname === "/api/mockmark/threads") return send(res, 200, store.list(url.searchParams.get("mockPath")));
        const body = await readJson(req);
        if (req.method === "POST" && url.pathname === "/api/mockmark/threads") return send(res, 201, { threadId: store.createThread(body) });
        if (req.method === "POST" && url.pathname === "/api/mockmark/messages") return send(res, 201, { messageId: store.addMessage(body) });
        if (req.method === "POST" && url.pathname === "/api/mockmark/reactions") return send(res, 200, store.toggleReaction(body));
        if (req.method === "POST" && url.pathname === "/api/mockmark/resolve") return send(res, 200, store.resolveThread(body));
        if (req.method === "POST" && url.pathname === "/api/mockmark/delete") return send(res, 200, store.deleteThread(body));
        return send(res, 404, { error: "Unknown Mockmark endpoint" });
      }
      let pathname = url.pathname;
      if (base !== "/" && pathname.startsWith(base)) pathname = pathname.slice(base.length);
      let file = safePath(mockDir, pathname);
      if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!file || !existsSync(file)) return send(res, 404, { error: "Not found" }, { "content-type":"application/json; charset=utf-8" });
      res.writeHead(200, { "content-type": MIME[extname(file).toLowerCase()] || "application/octet-stream" }); createReadStream(file).pipe(res);
    } catch (err) { send(res, err.status || 500, { error: err.message || "Server error" }); }
  });
}
