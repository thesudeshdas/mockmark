import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { extname, posix, relative, resolve, sep } from "node:path";

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
  validateDeploymentReferences(files);
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

function validateDeploymentReferences(files) {
  for (const file of files) {
    const type = file.contentType.split(";", 1)[0];
    if (type !== "text/html" && type !== "text/css") continue;
    const source = readFileSync(file.absolutePath, "utf8");
    const references = type === "text/html"
      ? [
          ...source.matchAll(/\b(?:href|src|poster)\s*=\s*(["'])(.*?)\1/gi),
          ...source.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi),
        ]
      : [...source.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)];
    for (const match of references) validateLocalReference(file.path, match[2]);
  }
}

function validateLocalReference(sourcePath, reference) {
  const value = reference.trim();
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return;
  const clean = value.split(/[?#]/, 1)[0];
  const target = clean.startsWith("/")
    ? posix.normalize(clean.slice(1))
    : posix.normalize(posix.join(posix.dirname(sourcePath), clean));
  if (target === ".." || target.startsWith("../"))
    throw new Error(`${sourcePath} references ${reference} outside the mock directory. Move supporting assets inside mockDir and update the reference.`);
}

function portable(path) { return path.split(sep).join("/"); }
