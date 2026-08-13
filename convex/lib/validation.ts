import { ConvexError } from "convex/values";

export const ALLOWED_REACTIONS = new Set(["👍", "👀", "✅", "❤️"]);

export function cleanText(
  value: string,
  field: string,
  min: number,
  max: number,
) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < min || clean.length > max)
    throw new ConvexError(`${field} must be ${min}-${max} characters.`);
  return clean;
}

export function cleanBody(value: string) {
  const clean = value.trim();
  if (!clean || clean.length > 4000)
    throw new ConvexError("Comment must be 1-4000 characters.");
  return clean;
}

export function cleanEmail(value?: string) {
  if (!value) return undefined;
  const clean = value.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(clean))
    throw new ConvexError("Enter a valid email address.");
  return clean;
}

export function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  if (slug.length < 2)
    throw new ConvexError("Name must contain at least two letters or numbers.");
  return slug;
}

export function validateRegion(input: {
  x: number;
  y: number;
  width?: number;
  height?: number;
}) {
  if (![input.x, input.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1))
    throw new ConvexError("Position must be within page bounds.");
  if ((input.width === undefined) !== (input.height === undefined))
    throw new ConvexError("Region width and height must be paired.");
  if (input.width !== undefined && input.height !== undefined) {
    if (
      ![input.width, input.height].every(
        (n) => Number.isFinite(n) && n > 0 && n <= 1,
      )
    )
      throw new ConvexError("Region size must be within page bounds.");
  }
}
