import { ConvexError, v } from "convex/values";
import { action, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { audit, requireProject } from "./lib/authz";
import { hashToken, randomToken } from "./lib/tokens";
import { cleanText } from "./lib/validation";

const kind = v.union(v.literal("installation"), v.literal("review"));

export const create = action({
  args: {
    projectId: v.id("projects"),
    kind,
    label: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ token: string; tokenId: string }> => {
    const token = randomToken(args.kind === "installation" ? "mmi" : "mmr");
    const tokenHash = await hashToken(token);
    const tokenId = await ctx.runMutation(internal.tokens.store, {
      ...args,
      tokenHash,
      tokenPrefix: token.slice(0, 12),
    });
    return { token, tokenId };
  },
});

export const store = internalMutation({
  args: {
    projectId: v.id("projects"),
    kind,
    label: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { project, userId } = await requireProject(
      ctx,
      args.projectId,
      "admin",
    );
    const tokenId = await ctx.db.insert("accessTokens", {
      ...args,
      label: cleanText(args.label, "Token label", 2, 80),
      createdBy: userId,
      createdAt: Date.now(),
    });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: `token.${args.kind}.created`,
      targetType: "accessToken",
      targetId: tokenId,
    });
    return tokenId;
  },
});

export const revoke = mutation({
  args: { tokenId: v.id("accessTokens") },
  handler: async (ctx, args) => {
    const token = await ctx.db.get(args.tokenId);
    if (!token) throw new ConvexError("Token not found.");
    const { project, userId } = await requireProject(
      ctx,
      token.projectId,
      "admin",
    );
    await ctx.db.patch(token._id, { revokedAt: Date.now() });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "token.revoked",
      targetType: "accessToken",
      targetId: token._id,
    });
  },
});
