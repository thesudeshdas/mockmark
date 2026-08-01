#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../src/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const assetsDir = join(root, "public", "mockmark");
const args = process.argv.slice(2);
const command = args[0] || "help";

function flag(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0) return args[idx + 1] ?? true;
  return fallback;
}
function positional(index, fallback) { return args[index] ?? fallback; }
function usage() {
  console.log(`mockmark\n\nCommands:\n  mockmark init [mock-dir]          Copy client assets and inject HTML files\n  mockmark inject [mock-dir]        Inject client tags only\n  mockmark serve [mock-dir]         Serve mocks + annotation API\n\nOptions:\n  --port 4317                       Server port\n  --data .mockmark/data.json        Annotation JSON store\n  --base /                          URL base when serving\n\nHTML can also opt in manually:\n  <link rel="stylesheet" href="/mockmark/client.css">\n  <script type="module" src="/mockmark/client.js"></script>`);
}
function walkHtml(dir) {
  const out=[];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p=join(dir,entry); const s=statSync(p);
    if (s.isDirectory()) out.push(...walkHtml(p));
    else if (extname(p).toLowerCase()==='.html') out.push(p);
  }
  return out;
}
function relAssetPath(htmlFile, mockDir, asset) {
  const from = dirname(htmlFile);
  const target = join(mockDir, "mockmark", asset);
  let rel = relative(from, target).replaceAll("\\", "/");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}
function injectFile(file, mockDir) {
  let html = readFileSync(file, 'utf8');
  if (html.includes('mockmark/client.js')) return false;
  const css = `<link rel="stylesheet" href="${relAssetPath(file, mockDir, 'client.css')}">`;
  const js = `<script type="module" src="${relAssetPath(file, mockDir, 'client.js')}"></script>`;
  if (/<\/head>/i.test(html)) html = html.replace(/<\/head>/i, `  ${css}\n</head>`);
  else html = `${css}\n${html}`;
  if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `  ${js}\n</body>`);
  else html = `${html}\n${js}\n`;
  writeFileSync(file, html);
  return true;
}
function copyAssets(mockDir) {
  const dest = join(mockDir, 'mockmark'); mkdirSync(dest, {recursive:true});
  for (const name of ['client.js','client.css']) copyFileSync(join(assetsDir, name), join(dest, name));
}
async function main() {
  if (["help","--help","-h"].includes(command)) return usage();
  const mockDir = resolve(positional(1, 'mocks'));
  if (command === 'init') {
    mkdirSync(mockDir, {recursive:true}); copyAssets(mockDir);
    const changed = walkHtml(mockDir).filter(f => !f.includes('/mockmark/')).map(f => injectFile(f, mockDir)).filter(Boolean).length;
    console.log(`Mockmark initialized in ${mockDir}; injected ${changed} HTML file(s).`); return;
  }
  if (command === 'inject') {
    const changed = walkHtml(mockDir).filter(f => !f.includes('/mockmark/')).map(f => injectFile(f, mockDir)).filter(Boolean).length;
    console.log(`Injected ${changed} HTML file(s).`); return;
  }
  if (command === 'serve') {
    copyAssets(mockDir);
    const port = Number(flag('port', process.env.PORT || 4317));
    const dataFile = resolve(String(flag('data', '.mockmark/data.json')));
    const base = String(flag('base', '/'));
    const server = createServer({ mockDir, dataFile, base });
    server.listen(port, () => console.log(`Mockmark serving ${mockDir} at http://localhost:${port}${base}`));
    return;
  }
  console.error(`Unknown command: ${command}`); usage(); process.exit(1);
}
main().catch((err)=>{ console.error(err.stack || err.message); process.exit(1); });
