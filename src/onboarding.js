import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const EXCLUDED_DIRS = new Set([
  ".git", ".hg", ".svn", ".mockmark", "node_modules", "bower_components",
  "jspm_packages", "vendor", "deps", ".deps", "dist", "dist-web", "build",
  "out", ".output", "coverage", ".next", ".nuxt", ".svelte-kit", ".turbo",
  ".cache", ".parcel-cache", "storybook-static", "target", "tmp", "temp",
  "generated", ".generated",
]);
const MOCK_DIR = /^(mocks?|mockups?|prototypes?|wireframes?)$/i;
const MOCK_FILE = /(?:^|[._-])(mock|mockup|prototype|wireframe)(?:[._-]|$)/i;
const MOCK_EXTENSIONS = new Set([".html", ".htm", ".svg"]);
const GENERATED_FILE = /(?:\.generated\.|\.gen\.|\.min\.|\.bundle\.|\.map$|^package-lock\.json$|^pnpm-lock\.yaml$|^yarn\.lock$)/i;
const TEXT_EXTENSIONS = new Set([
  "", ".css", ".cjs", ".html", ".htm", ".js", ".json", ".jsx", ".md",
  ".mjs", ".scss", ".sh", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);

export function ensureMockDirectory(root, name = "mocks") {
  const path = resolve(root, name);
  assertInsideRoot(root, path);
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
  return path;
}

export function discoverMocks(root, mockDir = resolve(root, "mocks")) {
  assertInsideRoot(root, mockDir);
  const candidates = [];
  walk(root, (path, entry, rel) => {
    if (path === mockDir || path.startsWith(`${mockDir}${sep}`)) return "skip";
    if (entry.isDirectory() && MOCK_DIR.test(entry.name)) {
      const files = listFiles(path, root, mockDir);
      if (files.length) candidates.push({ source: rel, kind: "directory", files });
      return "skip";
    }
    if (entry.isFile() && MOCK_EXTENSIONS.has(extname(entry.name).toLowerCase()) && MOCK_FILE.test(entry.name)) {
      candidates.push({ source: rel, kind: "file", files: [rel] });
    }
    return undefined;
  });
  return candidates.sort((a, b) => a.source.localeCompare(b.source));
}

export function createMigrationPlan(root, candidates, mockDir = resolve(root, "mocks")) {
  assertInsideRoot(root, mockDir);
  const moves = [];
  for (const candidate of candidates) {
    for (const source of candidate.files) {
      moves.push({ source, destination: relative(root, resolve(mockDir, source)) });
    }
  }
  const collisions = moves.filter(({ destination }) => existsSync(resolve(root, destination)));
  const references = collisions.length ? [] : [
    ...findReferenceUpdates(root, moves, mockDir),
    ...findMovedFileUpdates(root, moves),
  ];
  return { moves, collisions, references };
}

export function formatMigrationPlan(plan) {
  const lines = ["Mock migration plan:"];
  if (!plan.moves.length) lines.push("  No existing mocks found.");
  for (const move of plan.moves) lines.push(`  MOVE ${move.source} -> ${move.destination}`);
  for (const update of plan.references) lines.push(`  UPDATE ${update.path} (${update.replacements} reference${update.replacements === 1 ? "" : "s"})`);
  if (plan.collisions.length) {
    lines.push("Collisions (nothing will be moved):");
    for (const collision of plan.collisions) lines.push(`  ${collision.source} -> ${collision.destination}`);
  }
  return lines.join("\n");
}

export async function confirmMigration(plan, { yes = false, input = stdin, output = stdout } = {}) {
  if (!plan.moves.length) return false;
  if (plan.collisions.length) throw new Error("Resolve migration collisions, then run init again.");
  if (yes) return true;
  if (!input.isTTY || !output.isTTY) throw new Error("Migration requires review. Run with --dry-run, then rerun with --yes to confirm.");
  const prompt = createInterface({ input, output });
  try {
    const answer = await prompt.question("Apply this migration plan? [y/N] ");
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}

export function recoverIncompleteMigration(root) {
  const transactions = resolve(root, ".mockmark", "transactions");
  if (!existsSync(transactions)) return 0;
  let recovered = 0;
  for (const name of readdirSync(transactions)) {
    const transactionDir = resolve(transactions, name);
    const manifestPath = resolve(transactionDir, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.status !== "applying") continue;
    rollback(root, transactionDir, manifest);
    manifest.status = "rolled-back";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    recovered += 1;
  }
  return recovered;
}

export function applyMigration(root, plan) {
  if (plan.collisions.length) throw new Error("Cannot migrate while collisions exist.");
  if (!plan.moves.length) return { moved: 0, updated: 0 };
  const id = `${Date.now()}-${process.pid}`;
  const transactionDir = resolve(root, ".mockmark", "transactions", id);
  const backupDir = resolve(transactionDir, "backup");
  mkdirSync(backupDir, { recursive: true });
  const manifest = {
    version: 1,
    status: "applying",
    moves: plan.moves,
    references: plan.references.map(({ path, backupPath = path, restorePath = backupPath }) => ({ path, backupPath, restorePath })),
  };
  const manifestPath = resolve(transactionDir, "manifest.json");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  try {
    for (const update of plan.references) {
      const backupPath = update.backupPath ?? update.path;
      const source = resolve(root, backupPath);
      const backup = resolve(backupDir, backupPath);
      mkdirSync(dirname(backup), { recursive: true });
      cpSync(source, backup);
    }
    for (const move of plan.moves) movePath(root, move.source, move.destination);
    for (const update of plan.references) writeFileSync(resolve(root, update.path), update.content);
    manifest.status = "complete";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return { moved: plan.moves.length, updated: plan.references.length, transactionDir };
  } catch (error) {
    rollback(root, transactionDir, manifest);
    manifest.status = "rolled-back";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    throw error;
  }
}

function walk(root, visit, current = root) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && EXCLUDED_DIRS.has(entry.name)) continue;
    if (GENERATED_FILE.test(entry.name)) continue;
    const path = resolve(current, entry.name);
    const rel = relative(root, path);
    const action = visit(path, entry, rel);
    if (entry.isDirectory() && action !== "skip") walk(root, visit, path);
  }
}

function listFiles(directory, root, mockDir) {
  const files = [];
  walk(root, (path, entry, rel) => {
    if (path === mockDir || path.startsWith(`${mockDir}${sep}`)) return "skip";
    if (path !== directory && !path.startsWith(`${directory}${sep}`)) return entry.isDirectory() ? "skip" : undefined;
    if (entry.isFile()) files.push(rel);
    return undefined;
  }, directory);
  return files;
}

function findReferenceUpdates(root, moves, mockDir) {
  const updates = [];
  walk(root, (path, entry, rel) => {
    if (!entry.isFile() || !TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) return undefined;
    if (path === mockDir || path.startsWith(`${mockDir}${sep}`)) return undefined;
    if (moves.some((move) => move.source === rel)) return undefined;
    let content;
    try { content = readFileSync(path, "utf8"); } catch { return undefined; }
    if (content.includes("\0")) return undefined;
    let next = content;
    let replacements = 0;
    for (const move of moves) {
      const oldRelative = portableRelative(dirname(resolve(root, rel)), resolve(root, move.source));
      const newRelative = portableRelative(dirname(resolve(root, rel)), resolve(root, move.destination));
      const variants = new Map([
        [move.source, move.destination],
        [`/${move.source}`, `/${move.destination}`],
        [oldRelative, newRelative],
        [`./${oldRelative}`, `./${newRelative}`],
      ]);
      const result = replacePathVariants(next, [...variants]);
      next = result.content;
      replacements += result.count;
    }
    if (next !== content) updates.push({ path: rel, content: next, replacements });
    return undefined;
  });
  return updates;
}

function findMovedFileUpdates(root, moves) {
  const destinationBySource = new Map(moves.map((move) => [resolve(root, move.source), resolve(root, move.destination)]));
  const updates = [];
  for (const move of moves) {
    if (!TEXT_EXTENSIONS.has(extname(move.source).toLowerCase())) continue;
    const source = resolve(root, move.source);
    let content;
    try { content = readFileSync(source, "utf8"); } catch { continue; }
    if (content.includes("\0")) continue;
    let replacements = 0;
    const next = content.replace(/(["'`(])((?:\.\.\/|\.\/)[^"'`()\s?#]+)(?=[?#"'`)])/g, (match, prefix, ref) => {
      const oldTarget = resolve(dirname(source), ref);
      if (!existsSync(oldTarget) && !destinationBySource.has(oldTarget)) return match;
      const newTarget = destinationBySource.get(oldTarget) ?? oldTarget;
      let nextRef = portableRelative(dirname(resolve(root, move.destination)), newTarget);
      if (!nextRef.startsWith(".")) nextRef = `./${nextRef}`;
      if (nextRef === ref) return match;
      replacements += 1;
      return `${prefix}${nextRef}`;
    });
    if (next !== content) updates.push({
      path: move.destination,
      backupPath: move.source,
      restorePath: move.source,
      content: next,
      replacements,
    });
  }
  return updates;
}

function portableRelative(from, to) { return relative(from, to).split(sep).join("/"); }
function replacePathVariants(content, variants) {
  const usable = variants
    .filter(([from, to]) => from && from !== to)
    .sort(([a], [b]) => b.length - a.length);
  let next = content;
  let count = 0;
  const replacements = [];
  for (const [from, to] of usable) {
    const marker = `\u0001MOCKMARK_${replacements.length}\u0001`;
    const pattern = new RegExp(`(^|[\\s\\"'\\\`(=,:])${escapeRegExp(from)}(?=$|[\\s\\"'\\\`)?#,:])`, "gm");
    let matches = 0;
    next = next.replace(pattern, (_, prefix) => { matches += 1; return `${prefix}${marker}`; });
    if (!matches) continue;
    count += matches;
    replacements.push([marker, to]);
  }
  for (const [marker, to] of replacements) next = next.split(marker).join(to);
  return { content: next, count };
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function movePath(root, sourceRel, destinationRel) {
  const source = resolve(root, sourceRel);
  const destination = resolve(root, destinationRel);
  if (existsSync(destination)) throw new Error(`Collision: ${destinationRel}`);
  mkdirSync(dirname(destination), { recursive: true });
  if (isGitTracked(root, sourceRel)) {
    execFileSync("git", ["mv", "--", sourceRel, destinationRel], { cwd: root, stdio: "pipe" });
  } else {
    renameSync(source, destination);
  }
}

function isGitTracked(root, path) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", path], { cwd: root, stdio: "ignore" });
    return true;
  } catch { return false; }
}

function rollback(root, transactionDir, manifest) {
  for (const move of [...manifest.moves].reverse()) {
    const source = resolve(root, move.source);
    const destination = resolve(root, move.destination);
    if (!existsSync(destination) || existsSync(source)) continue;
    try {
      movePath(root, move.destination, move.source);
    } catch {
      mkdirSync(dirname(source), { recursive: true });
      renameSync(destination, source);
    }
  }
  for (const reference of manifest.references) {
    const { backupPath, restorePath } = typeof reference === "string"
      ? { backupPath: reference, restorePath: reference }
      : reference;
    const backup = resolve(transactionDir, "backup", backupPath);
    if (!existsSync(backup)) continue;
    mkdirSync(dirname(resolve(root, restorePath)), { recursive: true });
    cpSync(backup, resolve(root, restorePath));
  }
  removeEmptyMockParents(root, manifest.moves);
}

function assertInsideRoot(root, path) {
  const rel = relative(resolve(root), resolve(path));
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error("Mock directory must be inside repository root.");
  }
}

function removeEmptyMockParents(root, moves) {
  const dirs = new Set(moves.map(({ destination }) => dirname(resolve(root, destination))));
  for (const dir of [...dirs].sort((a, b) => b.length - a.length)) {
    if (dir === resolve(root, "mocks")) continue;
    try { if (readdirSync(dir).length === 0) rmSync(dir, { recursive: false }); } catch {}
  }
}
