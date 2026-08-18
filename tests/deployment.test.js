import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { collectDeploymentFiles, shareUrl } from "../src/deployment.js";

function fixture(t) {
  const root = mkdtempSync(resolve(tmpdir(), "mockmark-deploy-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function put(root, path, body) {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, body);
}

test("collects nested mock assets with deterministic metadata", (t) => {
  const root = fixture(t);
  put(root, "screens/home.html", "<h1>Home</h1>");
  put(root, "assets/app.css", "body{}");
  const files = collectDeploymentFiles(root);

  assert.deepEqual(files.map(({ path, contentType, size }) => ({ path, contentType, size })), [
    { path: "assets/app.css", contentType: "text/css; charset=utf-8", size: 6 },
    { path: "screens/home.html", contentType: "text/html", size: 13 },
  ]);
  assert.match(files[0].sha256, /^[a-f0-9]{64}$/);
});

test("rejects symlinks and deployments without HTML", (t) => {
  const root = fixture(t);
  put(root, "asset.txt", "asset");
  assert.throws(() => collectDeploymentFiles(root), /at least one HTML/);
  put(root, "index.html", "mock");
  symlinkSync(resolve(root, "asset.txt"), resolve(root, "linked.txt"));
  assert.throws(() => collectDeploymentFiles(root), /Symlinks are not allowed/);
});

test("rejects local asset references that escape the mock directory", (t) => {
  const root = fixture(t);
  put(root, "today/index.html", '<link rel="stylesheet" href="../../_theme.css"><h1>Today</h1>');

  assert.throws(
    () => collectDeploymentFiles(root),
    /today\/index\.html references \.\.\/\.\.\/_theme\.css outside the mock directory/,
  );
});

test("creates project-hosted share URLs without exposing session credentials", () => {
  const url = shareUrl("https://mockmark.example", "mmb_build", "flows/home.html");
  assert.equal(url, "https://mockmark.example/?deployment=mmb_build&path=flows%2Fhome.html");
  assert.doesNotMatch(url, /mms_/);
});
