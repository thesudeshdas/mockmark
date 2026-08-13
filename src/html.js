import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const START = "<!-- mockmark:start -->";
const END = "<!-- mockmark:end -->";

export function findHtml(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stats = statSync(path);
    if (stats.isDirectory() && entry !== "node_modules" && entry !== ".git") files.push(...findHtml(path));
    else if (stats.isFile() && extname(entry).toLowerCase() === ".html") files.push(path);
  }
  return files;
}

export function injectHtml(html, config) {
  if (html.includes(START)) return html;
  const appUrl = escapeAttribute(config.appUrl);
  const tag = `${START}\n<script async src="${appUrl}/embed.js" data-project="${escapeAttribute(config.projectKey)}" data-convex-url="${escapeAttribute(config.convexUrl)}" data-app-url="${appUrl}"></script>\n${END}`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `  ${tag}\n</body>`) : `${html}\n${tag}\n`;
}

export function removeInjection(html) {
  const start = html.indexOf(START), end = html.indexOf(END);
  if (start < 0 || end < start) return html;
  return `${html.slice(0, start)}${html.slice(end + END.length)}`.replace(/\n{3,}/g, "\n\n");
}

function escapeAttribute(value) { return String(value).replace(/[&"<>]/g, (char) => ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[char]); }
