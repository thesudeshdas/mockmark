import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, requireMembership, requireProject } from "./lib/authz";
import { cleanText, slugify } from "./lib/validation";

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const { userId } = await requireMembership(ctx, args.organizationId);
    const projectMemberships = await ctx.db
      .query("projectMemberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const projects = await Promise.all(
      projectMemberships.map((membership) => ctx.db.get(membership.projectId)),
    );
    return projects.filter(
      (project): project is NonNullable<typeof project> =>
        Boolean(project) &&
        project !== null &&
        project.organizationId === args.organizationId &&
        !project.deletedAt,
    );
  },
});

export const create = mutation({
  args: {
    organizationId: v.id("organizations"),
    name: v.string(),
    projectKey: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireMembership(
      ctx,
      args.organizationId,
      "admin",
    );
    const name = cleanText(args.name, "Project name", 2, 80);
    const slug = slugify(name);
    const duplicate = await ctx.db
      .query("projects")
      .withIndex("by_org_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", slug),
      )
      .unique();
    if (duplicate && !duplicate.deletedAt)
      throw new ConvexError("A project with this name already exists.");
    const projectId = await ctx.db.insert("projects", {
      organizationId: args.organizationId,
      name,
      slug,
      projectKey: args.projectKey,
      createdBy: userId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("projectMemberships", {
      projectId,
      userId,
      role: "admin",
      addedBy: userId,
      createdAt: Date.now(),
    });
    await audit(ctx, {
      organizationId: args.organizationId,
      projectId,
      actorUserId: userId,
      action: "project.created",
      targetType: "project",
      targetId: projectId,
    });
    return projectId;
  },
});

export const detail = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project, membership } = await requireProject(ctx, args.projectId);
    const [pages, builds, tokens] = await Promise.all([
      ctx.db
        .query("pages")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .collect(),
      ctx.db
        .query("builds")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .order("desc")
        .take(30),
      membership.role === "admin"
        ? ctx.db
            .query("accessTokens")
            .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
            .collect()
        : Promise.resolve([]),
    ]);
    return {
      project,
      role: membership.role,
      pages,
      builds,
      tokens: tokens.map(({ tokenHash: _tokenHash, ...token }) => token),
    };
  },
});

export const archive = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project, userId } = await requireProject(
      ctx,
      args.projectId,
      "admin",
    );
    await ctx.db.patch(project._id, { deletedAt: Date.now() });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "project.archived",
      targetType: "project",
      targetId: project._id,
    });
  },
});
