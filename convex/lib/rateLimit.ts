import { ConvexError } from "convex/values";
import type { GenericMutationCtx } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

export async function consumeRateLimit(
  ctx: GenericMutationCtx<DataModel>,
  key: string,
  limit: number,
  windowMs = 60_000,
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!existing) {
    await ctx.db.insert("rateLimits", {
      key,
      windowStart: now,
      count: 1,
      updatedAt: now,
    });
    return;
  }
  if (existing.windowStart + windowMs <= now) {
    await ctx.db.patch(existing._id, {
      windowStart: now,
      count: 1,
      updatedAt: now,
    });
    return;
  }
  if (existing.count >= limit)
    throw new ConvexError("Too many requests. Try again shortly.");
  await ctx.db.patch(existing._id, {
    count: existing.count + 1,
    updatedAt: now,
  });
}
