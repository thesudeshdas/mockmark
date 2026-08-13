import { v } from "convex/values";
import { action, internalMutation, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { audit, requireProject } from "./lib/authz";
import { hashToken, randomToken } from "./lib/tokens";

export const create = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<{ token: string; expiresAt: number }> => {
    const token = randomToken("mms");
    const tokenHash = await hashToken(token);
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    await ctx.runMutation(internal.previewSessions.store, {
      projectId: args.projectId,
      tokenHash,
      expiresAt,
    });
    return { token, expiresAt };
  },
});

export const createForProject = action({
  args: { projectKey: v.string(), origin: v.string() },
  handler: async (ctx, args): Promise<{ token: string; expiresAt: number }> => {
    const token = randomToken("mms");
    const tokenHash = await hashToken(token);
    const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    await ctx.runMutation(internal.previewSessions.storeForProject, {
      projectKey: args.projectKey,
      origin: args.origin,
      tokenHash,
      expiresAt,
    });
    return { token, expiresAt };
  },
});

export const store = internalMutation({
  args: {
    projectId: v.id("projects"),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { project, userId } = await requireProject(ctx, args.projectId);
    const sessionId = await ctx.db.insert("memberPreviewSessions", {
      ...args,
      userId,
      createdAt: Date.now(),
    });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "preview_session.created",
      targetType: "memberPreviewSession",
      targetId: sessionId,
    });
    return sessionId;
  },
});

export const storeForProject = internalMutation({
  args: {
    projectKey: v.string(),
    origin: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_project_key", (q) => q.eq("projectKey", args.projectKey))
      .unique();
    if (!project) throw new Error("Project not found.");
    const { project: authorized, userId } = await requireProject(ctx, project._id);
    let origin: URL;
    try {
      origin = new URL(args.origin);
    } catch {
      throw new Error("Mock origin is not authorized for this project.");
    }
    const allowedOrigin = await ctx.db
      .query("projectOrigins")
      .withIndex("by_project_origin", (q) =>
        q.eq("projectId", authorized._id).eq("origin", origin.origin),
      )
      .unique();
    const isLocal = ["localhost", "127.0.0.1", "::1"].includes(origin.hostname);
    if ((!allowedOrigin && !isLocal) || origin.origin !== args.origin)
      throw new Error("Mock origin is not authorized for this project.");
    const sessionId = await ctx.db.insert("memberPreviewSessions", {
      projectId: authorized._id,
      userId,
      tokenHash: args.tokenHash,
      createdAt: Date.now(),
      expiresAt: args.expiresAt,
    });
    await audit(ctx, {
      organizationId: authorized.organizationId,
      projectId: authorized._id,
      actorUserId: userId,
      action: "preview_session.created",
      targetType: "memberPreviewSession",
      targetId: sessionId,
    });
    return sessionId;
  },
});

export const revoke = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { userId } = await requireProject(ctx, args.projectId);
    const sessions = await ctx.db
      .query("memberPreviewSessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions)
      if (session.projectId === args.projectId && !session.revokedAt)
        await ctx.db.patch(session._id, { revokedAt: Date.now() });
  },
});
