const ALLOWED_REACTIONS = new Set(["👍", "👀", "✅", "❤️"]);
export function normalizeMockPath(value) {
  const clean = String(value || "").trim().replaceAll("\\", "/").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || clean.length > 240) throw Object.assign(new Error("Invalid mock path"), { status: 400 });
  return clean;
}
export function normalizeAuthorName(value) {
  const clean = String(value || "").trim().replace(/\s+/g, " ");
  if (clean.length < 2 || clean.length > 80) throw Object.assign(new Error("Author name must be 2-80 chars"), { status: 400 });
  return clean;
}
export function normalizeBody(value) {
  const clean = String(value || "").trim();
  if (clean.length < 1 || clean.length > 4000) throw Object.assign(new Error("Comment body must be 1-4000 chars"), { status: 400 });
  return clean;
}
export function normalizeRegion(input) {
  const num = (v) => Number(v);
  const x = num(input.x), y = num(input.y);
  const width = input.width == null ? undefined : num(input.width);
  const height = input.height == null ? undefined : num(input.height);
  for (const [key, val] of Object.entries({x,y})) if (!Number.isFinite(val) || val < 0 || val > 1) throw Object.assign(new Error(`${key} must be 0..1`), { status: 400 });
  if ((width == null) !== (height == null)) throw Object.assign(new Error("width and height must be paired"), { status: 400 });
  if (width != null) {
    if (![width,height].every((v) => Number.isFinite(v) && v > 0 && v <= 1)) throw Object.assign(new Error("region size must be 0..1"), { status: 400 });
    return { x, y, width: Math.min(width, 1 - x), height: Math.min(height, 1 - y) };
  }
  return { x, y };
}
export function normalizeReactionEmoji(value) {
  const emoji = String(value || "").trim();
  if (!ALLOWED_REACTIONS.has(emoji)) throw Object.assign(new Error("Unsupported reaction"), { status: 400 });
  return emoji;
}
