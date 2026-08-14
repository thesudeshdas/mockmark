#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { findHtml, injectHtml, removeInjection } from "../src/html.js";
import { loadConfig, saveConfig, validateProjectKey, validateUrl } from "../src/config.js";
import { cleanError } from "../src/errors.js";
import {
  applyMigration,
  confirmMigration,
  createMigrationPlan,
  discoverMocks,
  ensureMockDirectory,
  formatMigrationPlan,
  recoverIncompleteMigration,
} from "../src/onboarding.js";

const args = process.argv.slice(2);
const command = args.shift() ?? "help";
const flags = parseArgs(args);

function usage() {
  console.log(`mockmark — repo-scoped mock feedback

Commands:
  mockmark init [mock-dir] [--project KEY --convex-url URL --app-url URL] [--dry-run] [--yes]
  mockmark inject [mock-dir]
  mockmark login TOKEN
  mockmark status
  mockmark comments [--all] [--page PAGE_KEY] [--json] [--since ISO_DATE]
  mockmark open
  mockmark uninstall [mock-dir]

Install and config affect only current repository. Credentials stay outside repo.`);
}

async function main() {
  if (["help", "--help", "-h"].includes(command)) return usage();
  if (command === "init") return init();
  if (command === "inject") return inject();
  if (command === "login") return login();
  if (command === "status") return status();
  if (command === "comments") return comments();
  if (command === "open") return openDashboard();
  if (command === "uninstall") return uninstall();
  throw new Error(`Unknown command: ${command}`);
}

async function init() {
  const mockDir = resolve(flags._[0] ?? "mocks");
  const linking = ["project", "convex-url", "app-url"].some((name) => flags[name] !== undefined);
  const projectKey = linking ? validateProjectKey(required("project")) : undefined;
  const convexUrl = linking ? validateUrl(required("convex-url"), "Convex URL") : undefined;
  const appUrl = linking ? validateUrl(required("app-url"), "App URL") : undefined;
  const recovered = recoverIncompleteMigration(process.cwd());
  if (recovered) console.log(`Recovered ${recovered} incomplete migration(s).`);
  ensureMockDirectory(process.cwd(), relativeFromCwd(mockDir));
  const candidates = discoverMocks(process.cwd(), mockDir);
  const plan = createMigrationPlan(process.cwd(), candidates, mockDir);
  console.log(formatMigrationPlan(plan));
  if (plan.collisions.length) throw new Error("Resolve migration collisions, then run init again.");
  if (flags["dry-run"]) return;
  if (plan.moves.length) {
    const confirmed = await confirmMigration(plan, { yes: Boolean(flags.yes) });
    if (!confirmed) {
      console.log("Migration cancelled; no files moved.");
      return;
    }
    const result = applyMigration(process.cwd(), plan);
    console.log(`Migrated ${result.moved} file(s); updated ${result.updated} referencing file(s).`);
  }
  if (!linking) {
    console.log(`Mock folder ready at ${mockDir}. Add project flags to link and inject Mockmark.`);
    return;
  }
  const config = { version: 1, projectKey, convexUrl, appUrl, mockDir: relativeFromCwd(mockDir) };
  saveConfig(process.cwd(), config);
  ensureIgnore();
  const changed = injectDirectory(mockDir, config);
  console.log(`Mockmark linked to this repository; injected ${changed} HTML file(s) in ${mockDir}.`);
  console.log(`Next: npx mockmark login <installation-token>`);
}

function inject() {
  const config = loadConfig(process.cwd());
  const mockDir = resolve(flags._[0] ?? config.mockDir);
  const changed = injectDirectory(mockDir, config);
  console.log(`Injected ${changed} HTML file(s).`);
}

async function login() {
  const config = loadConfig(process.cwd());
  const token = String(flags._[0] ?? "").trim();
  if (!token.startsWith("mmi_")) throw new Error("Use an installation token beginning with mmi_.");
  await readFeedback(config, token, { unresolvedOnly: true });
  saveCredential(config.projectKey, token);
  console.log(`Authenticated project ${config.projectKey}. Token stored outside repository with user-only permissions.`);
}

async function status() {
  const config = loadConfig(process.cwd());
  const token = loadCredential(config.projectKey);
  const data = await readFeedback(config, token, { unresolvedOnly: true });
  console.log(`Connected: ${data.project.name}`);
  console.log(`Open conversations: ${data.threads.length}`);
  console.log(`Convex: ${config.convexUrl}`);
}

async function comments() {
  const config = loadConfig(process.cwd());
  const token = loadCredential(config.projectKey);
  const since = flags.since ? Date.parse(String(flags.since)) : undefined;
  if (flags.since && !Number.isFinite(since)) throw new Error("--since must be a valid ISO date.");
  const data = await readFeedback(config, token, { pageKey: stringFlag("page"), unresolvedOnly: !flags.all, updatedSince: since });
  if (flags.json) return console.log(JSON.stringify({ version: 1, ...data }, null, 2));
  console.log(formatMarkdown(data));
}

function openDashboard() {
  const config = loadConfig(process.cwd());
  const url = `${config.appUrl}/?project=${encodeURIComponent(config.projectKey)}`;
  console.log(url);
}

function uninstall() {
  const config = loadConfig(process.cwd());
  const mockDir = resolve(flags._[0] ?? config.mockDir);
  let changed = 0;
  for (const file of findHtml(mockDir)) {
    const html = readFileSync(file, "utf8");
    const next = removeInjection(html);
    if (next !== html) { writeFileSync(file, next); changed += 1; }
  }
  console.log(`Removed Mockmark loader from ${changed} HTML file(s). Hosted feedback remains intact.`);
}

function injectDirectory(mockDir, config) {
  if (!existsSync(mockDir)) throw new Error(`Mock directory not found: ${mockDir}`);
  let changed = 0;
  for (const file of findHtml(mockDir)) {
    const html = readFileSync(file, "utf8");
    const next = injectHtml(html, config);
    if (next !== html) { writeFileSync(file, next); changed += 1; }
  }
  return changed;
}

async function readFeedback(config, token, options) {
  const client = new ConvexHttpClient(config.convexUrl);
  const ref = makeFunctionReference("publicApi:read");
  return client.action(ref, { token, projectKey: config.projectKey, ...options });
}

function formatMarkdown(data) {
  const out = [`# Mockmark feedback — ${data.project.name}`, "", `Fetched: ${new Date(data.fetchedAt).toISOString()}`, `Conversations: ${data.threads.length}`, ""];
  for (const [index, thread] of data.threads.entries()) {
    out.push(`## ${index + 1}. ${thread.resolvedAt ? "[resolved]" : "[open]"} ${thread.page?.path ?? "Unknown page"}`, "");
    if (thread.nearbyText) out.push(`Context: ${thread.nearbyText}`, "");
    if (thread.selector) out.push(`DOM: \`${thread.selector}\``, "");
    if (thread.build?.commitSha) out.push(`Build: \`${thread.build.commitSha}\`${thread.build.branch ? ` (${thread.build.branch})` : ""}`, "");
    for (const message of thread.messages) out.push(`- **${message.authorName}** (${new Date(message.createdAt).toISOString()}): ${message.body.replace(/\n/g, " ")}`);
    out.push("");
  }
  return out.join("\n");
}

function credentialPath(projectKey) { return resolve(homedir(), ".config", "mockmark", `${projectKey}.json`); }
function saveCredential(projectKey, token) { const path = credentialPath(projectKey); mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); writeFileSync(path, JSON.stringify({ token }, null, 2), { mode: 0o600 }); chmodSync(path, 0o600); }
function loadCredential(projectKey) { const path = credentialPath(projectKey); if (!existsSync(path)) throw new Error("CLI is not authenticated. Run: npx mockmark login <installation-token>"); return JSON.parse(readFileSync(path, "utf8")).token; }
function ensureIgnore() { const path = resolve(".gitignore"); const current = existsSync(path) ? readFileSync(path, "utf8") : ""; const entries = [".env.local", ".mockmark/"]; let next = current; for (const entry of entries) if (!current.split(/\r?\n/).includes(entry)) next += `${next && !next.endsWith("\n") ? "\n" : ""}${entry}\n`; if (next !== current) writeFileSync(path, next); }
function required(name) { const value = flags[name]; if (!value || value === true) throw new Error(`--${name} is required.`); return String(value); }
function stringFlag(name) { const value = flags[name]; return typeof value === "string" ? value : undefined; }
function relativeFromCwd(path) { const prefix = `${process.cwd()}/`; return path.startsWith(prefix) ? path.slice(prefix.length) : path; }
function parseArgs(values) { const parsed = { _: [] }; for (let i = 0; i < values.length; i += 1) { const value = values[i]; if (!value.startsWith("--")) { parsed._.push(value); continue; } const [raw, inline] = value.slice(2).split("=", 2); if (inline !== undefined) parsed[raw] = inline; else if (values[i + 1] && !values[i + 1].startsWith("--")) parsed[raw] = values[++i]; else parsed[raw] = true; } return parsed; }

main().catch((error) => { console.error(`Mockmark: ${cleanError(error)}`); process.exitCode = 1; });
