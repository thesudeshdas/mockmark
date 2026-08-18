import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";

const CONTENT_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html"],
  [".htm", "text/html"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

export function collectDeploymentFiles(mockDir) {
  const root = resolve(mockDir);
  const files = [];
  visit(root, root, files);
  files.sort((a, b) => a.path.localeCompare(b.path));
  if (!files.length) throw new Error(`Mock directory is empty: ${root}`);
  if (!files.some((file) => file.contentType === "text/html"))
    throw new Error("Mock deployment must contain at least one HTML file.");
  return files;
}

export function shareUrl(appUrl, deploymentKey, path) {
  const url = new URL(appUrl);
  url.searchParams.set("deployment", deploymentKey);
  url.searchParams.set("path", path);
  return url.toString();
}

function visit(root, directory, files) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = resolve(directory, entry.name);
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink()) throw new Error(`Symlinks are not allowed in mock deployments: ${portable(relative(root, absolutePath))}`);
    if (stat.isDirectory()) {
      visit(root, absolutePath, files);
      continue;
    }
    if (!stat.isFile()) continue;
    const body = readFileSync(absolutePath);
    files.push({
      path: portable(relative(root, absolutePath)),
      absolutePath,
      contentType: CONTENT_TYPES.get(extname(entry.name).toLowerCase()) ?? "application/octet-stream",
      size: body.byteLength,
      sha256: createHash("sha256").update(body).digest("hex"),
    });
  }
}

function portable(path) { return path.split(sep).join("/"); }
