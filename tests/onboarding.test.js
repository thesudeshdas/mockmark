import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import {
  applyMigration,
  createMigrationPlan,
  discoverMocks,
  ensureMockDirectory,
  formatMigrationPlan,
  recoverIncompleteMigration,
} from "../src/onboarding.js";

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), "mockmark-onboarding-"));
  test.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function put(root, path, content = "") {
  const target = resolve(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

test("creates the default mocks directory when missing", () => {
  const root = fixture();
  const path = ensureMockDirectory(root);
  assert.equal(path, resolve(root, "mocks"));
  assert.ok(existsSync(path));
  assert.doesNotThrow(() => ensureMockDirectory(root));
});

test("discovers named mock directories and standalone mock files", () => {
  const root = fixture();
  put(root, "design/prototypes/mobile/home.html", "home");
  put(root, "archive/checkout.mock.html", "checkout");
  put(root, "src/index.html", "app");

  assert.deepEqual(discoverMocks(root).map(({ source, kind }) => ({ source, kind })), [
    { source: "archive/checkout.mock.html", kind: "file" },
    { source: "design/prototypes", kind: "directory" },
  ]);
});

test("excludes dependencies, build output, generated files, and existing mocks", () => {
  const root = fixture();
  for (const path of [
    ".git/mock.html",
    "node_modules/pkg/mocks/a.html",
    "vendor/mocks/a.html",
    "build/mocks/a.html",
    "dist/prototype.html",
    ".next/wireframe.html",
    "coverage/mock.html",
    "mocks/existing.html",
    "drafts/checkout.mock.generated.html",
    "drafts/checkout.mock.min.html",
  ]) put(root, path, "ignored");

  assert.deepEqual(discoverMocks(root), []);
});

test("migrates confirmed mocks, preserves structure, and updates references", () => {
  const root = fixture();
  put(root, "assets/site.css", "body{}");
  put(root, "prototypes/pages/home.html", '<link href="../../assets/site.css"><a href="./detail.html">Detail</a>');
  put(root, "prototypes/pages/detail.html", "detail");
  put(root, "src/routes.js", 'export const mock = "../prototypes/pages/home.html";');
  put(root, "package.json", '{"mock":"prototypes/pages/home.html"}\n');
  ensureMockDirectory(root);

  const plan = createMigrationPlan(root, discoverMocks(root));
  assert.match(formatMigrationPlan(plan), /MOVE prototypes\/pages\/home\.html -> mocks\/prototypes\/pages\/home\.html/);
  assert.match(formatMigrationPlan(plan), /UPDATE src\/routes\.js/);
  const result = applyMigration(root, plan);

  assert.equal(result.moved, 2);
  assert.ok(existsSync(resolve(root, "mocks/prototypes/pages/home.html")));
  assert.ok(!existsSync(resolve(root, "prototypes/pages/home.html")));
  assert.match(readFileSync(resolve(root, "src/routes.js"), "utf8"), /\.\.\/mocks\/prototypes\/pages\/home\.html/);
  assert.match(readFileSync(resolve(root, "package.json"), "utf8"), /mocks\/prototypes\/pages\/home\.html/);
  assert.match(readFileSync(resolve(root, "mocks/prototypes/pages/home.html"), "utf8"), /\.\.\/\.\.\/\.\.\/assets\/site\.css/);
  assert.match(readFileSync(resolve(root, "mocks/prototypes/pages/home.html"), "utf8"), /\.\/detail\.html/);
});

test("reports collisions and never overwrites destination files", () => {
  const root = fixture();
  put(root, "mockups/a.html", "source");
  put(root, "mocks/mockups/a.html", "destination");
  const plan = createMigrationPlan(root, discoverMocks(root));

  assert.deepEqual(plan.collisions, [{ source: "mockups/a.html", destination: "mocks/mockups/a.html" }]);
  assert.throws(() => applyMigration(root, plan), /collisions exist/);
  assert.equal(readFileSync(resolve(root, "mocks/mockups/a.html"), "utf8"), "destination");
  assert.equal(readFileSync(resolve(root, "mockups/a.html"), "utf8"), "source");
});

test("rolls back earlier moves and reference edits when migration fails", () => {
  const root = fixture();
  put(root, "account.mock.html", "account");
  put(root, "checkout.mock.html", "checkout");
  put(root, "routes.js", '"./account.mock.html" "./checkout.mock.html"');
  ensureMockDirectory(root);
  const plan = createMigrationPlan(root, discoverMocks(root));
  put(root, "mocks/checkout.mock.html", "late collision");

  assert.throws(() => applyMigration(root, plan), /Collision/);
  assert.equal(readFileSync(resolve(root, "account.mock.html"), "utf8"), "account");
  assert.equal(readFileSync(resolve(root, "checkout.mock.html"), "utf8"), "checkout");
  assert.equal(readFileSync(resolve(root, "routes.js"), "utf8"), '"./account.mock.html" "./checkout.mock.html"');
});

test("repeat discovery is idempotent after migration", () => {
  const root = fixture();
  put(root, "wireframes/settings.html", "settings");
  ensureMockDirectory(root);
  applyMigration(root, createMigrationPlan(root, discoverMocks(root)));

  assert.deepEqual(discoverMocks(root), []);
  assert.deepEqual(createMigrationPlan(root, discoverMocks(root)).moves, []);
});

test("recovers an interrupted transaction on the next run", () => {
  const root = fixture();
  put(root, "mockups/profile.html", "profile");
  put(root, "routes.js", '"./mockups/profile.html"');
  ensureMockDirectory(root);
  const result = applyMigration(root, createMigrationPlan(root, discoverMocks(root)));
  const manifestPath = resolve(result.transactionDir, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, status: "applying" }, null, 2)}\n`);

  assert.equal(recoverIncompleteMigration(root), 1);
  assert.equal(readFileSync(resolve(root, "mockups/profile.html"), "utf8"), "profile");
  assert.equal(readFileSync(resolve(root, "routes.js"), "utf8"), '"./mockups/profile.html"');
  assert.ok(!existsSync(resolve(root, "mocks/mockups/profile.html")));
  assert.equal(recoverIncompleteMigration(root), 0);
});

test("rejects destinations outside the repository", () => {
  const root = fixture();
  assert.throws(() => ensureMockDirectory(root, "../mocks"), /inside repository root/);
});

test("uses git mv for tracked mock files", () => {
  const root = fixture();
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Mockmark Test"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@mockmark.invalid"], { cwd: root });
  put(root, "prototype.mock.html", "tracked");
  execFileSync("git", ["add", "prototype.mock.html"], { cwd: root });
  execFileSync("git", ["commit", "-qm", "add mock"], { cwd: root });
  ensureMockDirectory(root);
  applyMigration(root, createMigrationPlan(root, discoverMocks(root)));

  const status = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" });
  assert.match(status, /R\s+prototype\.mock\.html -> mocks\/prototype\.mock\.html/);
});

test("CLI init creates mocks and is safe on repeat runs", () => {
  const root = fixture();
  const cli = resolve(import.meta.dirname, "../bin/mockmark.js");
  const args = [cli, "init", "--yes", "--project", `mmp_${"a".repeat(36)}`, "--convex-url", "https://example.convex.cloud", "--app-url", "https://mockmark.example"];
  execFileSync(process.execPath, [cli, "init", "--yes"], { cwd: root, encoding: "utf8" });
  assert.ok(existsSync(resolve(root, "mocks")));
  assert.ok(!existsSync(resolve(root, ".mockmark.json")));
  execFileSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  execFileSync(process.execPath, args, { cwd: root, encoding: "utf8" });

  assert.equal(JSON.parse(readFileSync(resolve(root, ".mockmark.json"), "utf8")).mockDir, "mocks");
});

test("non-interactive init prints a plan but moves nothing without confirmation", () => {
  const root = fixture();
  const cli = resolve(import.meta.dirname, "../bin/mockmark.js");
  put(root, "wireframes/home.html", "home");
  assert.throws(
    () => execFileSync(process.execPath, [cli, "init"], { cwd: root, encoding: "utf8", stdio: "pipe" }),
    (error) => error.stderr.includes("Migration requires review"),
  );
  assert.equal(readFileSync(resolve(root, "wireframes/home.html"), "utf8"), "home");
  assert.ok(!existsSync(resolve(root, "mocks/wireframes/home.html")));
});
