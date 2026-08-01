#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const assetsDir = join(root, "public", "mockmark");
const args = process.argv.slice(2);
const command = args[0] || "help";

function usage() {
  console.log(`mockmark\n\nBackendless mock comments. No hosted service. No database. No tracking.\n\nCommands:\n  mockmark init [mock-dir]          Copy client assets and inject HTML files\n  mockmark inject [mock-dir]        Inject client tags only\n\nPreview with any static server, for example:\n  python3 -m http.server 4317 -d docs/mockups\n\nHTML can also opt in manually:\n  <link rel="stylesheet" href="/mockmark/client.css">\n  <script type="module" src="/mockmark/client.js"></script>`);
}
function positional(index, fallback) { return args[index] ?? fallback; }
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
    console.log(`Mockmark initialized in ${mockDir}; injected ${changed} HTML file(s).`);
    console.log(`Serve statically with: python3 -m http.server 4317 -d ${mockDir}`);
    return;
  }
  if (command === 'inject') {
    const changed = walkHtml(mockDir).filter(f => !f.includes('/mockmark/')).map(f => injectFile(f, mockDir)).filter(Boolean).length;
    console.log(`Injected ${changed} HTML file(s).`); return;
  }
  console.error(`Unknown command: ${command}`); usage(); process.exit(1);
}
main().catch((err)=>{ console.error(err.stack || err.message); process.exit(1); });
