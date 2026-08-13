import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadConfig(cwd) {
  const path = resolve(cwd, ".mockmark.json");
  if (!existsSync(path)) throw new Error("Mockmark is not initialized in this repository.");
  const config = JSON.parse(readFileSync(path, "utf8"));
  if (config.version !== 1) throw new Error("Unsupported .mockmark.json version.");
  validateProjectKey(config.projectKey); validateUrl(config.convexUrl, "Convex URL"); validateUrl(config.appUrl, "App URL");
  if (!config.mockDir) throw new Error("mockDir is missing from .mockmark.json.");
  return config;
}

export function saveConfig(cwd, config) { writeFileSync(resolve(cwd, ".mockmark.json"), `${JSON.stringify(config, null, 2)}\n`); }
export function validateProjectKey(value) { const clean = String(value ?? "").trim(); if (!/^mmp_[a-f0-9]{24,80}$/.test(clean)) throw new Error("Invalid Mockmark project key."); return clean; }
export function validateUrl(value, label) { const url = new URL(String(value)); if (!/^https?:$/.test(url.protocol)) throw new Error(`${label} must use HTTP(S).`); return url.origin; }
