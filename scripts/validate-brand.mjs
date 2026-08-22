import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docs = resolve(root, "docs");
const required = [
  "brand-research.md",
  "ai-slop-design-research.md",
  "brand-directions.md",
  "brand-guidelines.md",
  "brand-guidelines.html",
  "brand-assets/tokens.css",
  "brand-assets/tokens.json",
  "brand-assets/mockmark-mark.svg",
  "brand-assets/mockmark-mark-monochrome.svg",
  "brand-assets/mockmark-lockup.svg",
  "brand-assets/favicon.svg",
  "brand-assets/review-signal-pattern.svg",
  "brand-assets/direction-review-signal.svg",
  "brand-assets/direction-build-trace.svg",
  "brand-assets/direction-studio-margin.svg",
  "brand-assets/fonts/Recursive-VF-LatinBasic.woff2",
  "brand-assets/fonts/OFL-Recursive.txt",
];

const failures = [];
const pass = (message) => console.log(`PASS ${message}`);
const fail = (message) => failures.push(message);

for (const path of required) {
  try {
    await access(resolve(docs, path));
    pass(path);
  } catch {
    fail(`missing ${path}`);
  }
}

const tokens = JSON.parse(await readFile(resolve(docs, "brand-assets/tokens.json"), "utf8"));
if (tokens.name !== "Mockmark Review Signal") fail("unexpected token set name");
else pass("tokens JSON parses and names Review Signal");

const html = await readFile(resolve(docs, "brand-guidelines.html"), "utf8");
const window = new Window({ url: "https://mockmark.local/docs/brand-guidelines.html" });
window.document.write(html);
const { document } = window;

if (document.querySelectorAll("h1").length !== 1) fail("HTML must have exactly one h1");
else pass("HTML heading root");

const ids = [...document.querySelectorAll("[id]")].map((node) => node.id);
if (new Set(ids).size !== ids.length) fail("HTML contains duplicate ids");
else pass("HTML ids unique");

for (const image of document.querySelectorAll("img")) {
  if (!image.hasAttribute("alt")) fail(`image missing alt: ${image.getAttribute("src")}`);
}
pass("HTML images expose alt text");

for (const ref of [...html.matchAll(/(?:src|href)="((?:brand-assets\/)[^"]+)"/g)].map((match) => match[1])) {
  try {
    await access(resolve(docs, ref));
  } catch {
    fail(`broken local reference ${ref}`);
  }
}
pass("HTML local asset references resolve");

const forbiddenCss = ["linear-gradient(", "radial-gradient(", "filter:blur(", "box-shadow:0 0 40px"];
for (const term of forbiddenCss) {
  if (html.toLowerCase().includes(term)) fail(`forbidden visual device in HTML: ${term}`);
}
if (!failures.some((item) => item.startsWith("forbidden visual"))) pass("HTML avoids prohibited gradient/glow devices");

const productionCss = await readFile(resolve(root, "src/app/styles.css"), "utf8");
if (/gradient\s*\(/i.test(productionCss)) fail("production CSS contains gradient styling");
else pass("production CSS avoids gradients");
if (/\bInter\b/.test(productionCss)) fail("production CSS restores generic Inter typography");
else pass("production CSS uses branded typography");

const retiredPalette = ["#f05a38", "#ff7858", "#ee5b35", "#f6f1e8", "#f6f4ef", "#fffcf7", "#eee7dc"];
const machineSources = `${html}\n${productionCss}\n${JSON.stringify(tokens)}\n${await readFile(resolve(docs, "brand-assets/tokens.css"), "utf8")}`.toLowerCase();
for (const color of retiredPalette) {
  if (machineSources.includes(color)) fail(`retired warm/Claude-adjacent color remains: ${color}`);
}
if (!failures.some((item) => item.startsWith("retired warm"))) pass("retired warm/orange palette absent from machine sources");

const fontPath = resolve(docs, "brand-assets/fonts/Recursive-VF-LatinBasic.woff2");
const font = await readFile(fontPath);
const fontHash = createHash("sha256").update(font).digest("hex");
if (fontHash !== "7af699706ba1d2a1947f4755d177927597b24c168f8d46585dabdb080e4d113c") fail(`font checksum changed: ${fontHash}`);
else pass(`font checksum (${(await stat(fontPath)).size} bytes)`);

const rgb = (hex) => hex.match(/[\da-f]{2}/gi).map((part) => Number.parseInt(part, 16) / 255);
const linear = (value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

const pairs = [
  ["ink / surface", "#15181D", "#FFFFFF", 4.5],
  ["muted / canvas", "#5D6672", "#F2F4F6", 4.5],
  ["ink / mark", "#15181D", "#FFD84D", 4.5],
  ["white / mark-strong", "#FFFFFF", "#6B5200", 4.5],
  ["focus / surface", "#0A65FF", "#FFFFFF", 3],
  ["dark text / canvas", "#F5F7FA", "#101318", 4.5],
  ["dark muted / canvas", "#AAB2BE", "#101318", 4.5],
  ["dark canvas / mark", "#101318", "#FFE05C", 4.5],
  ["dark focus / canvas", "#7CB0FF", "#101318", 3],
];

for (const [name, foreground, background, minimum] of pairs) {
  const ratio = contrast(foreground, background);
  if (ratio < minimum) fail(`${name} contrast ${ratio.toFixed(2)} < ${minimum}`);
  else pass(`${name} contrast ${ratio.toFixed(2)}:1`);
}

if (failures.length) {
  console.error("\nBrand validation failed:");
  for (const message of failures) console.error(`- ${message}`);
  process.exitCode = 1;
} else {
  console.log("\nBrand validation complete: all checks passed.");
}
