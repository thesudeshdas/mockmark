import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { audit, requireMembership, requireUser } from "./lib/authz";
import { cleanEmail, cleanText, slugify } from "./lib/validation";

const role = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("commenter"),
  v.literal("viewer"),
);

export const bootstrap = mutation({
  args: { name: v.string(), workspaceName: v.string() },
  handler: async (ctx, args) => {
    const { userId, user } = await requireUser(ctx);
    const name = cleanText(args.name, "Name", 2, 80);
    if (user.name !== name) await ctx.db.patch(userId, { name });
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return existing.organizationId;
    const workspaceName = cleanText(
      args.workspaceName,
      "Workspace name",
      2,
      80,
    );
    const baseSlug = slugify(workspaceName);
    let slug = baseSlug;
    for (
      let suffix = 2;
      await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      suffix += 1
    )
      slug = `${baseSlug}-${suffix}`;
    const organizationId = await ctx.db.insert("organizations", {
      name: workspaceName,
      slug,
      createdBy: userId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("memberships", {
      organizationId,
      userId,
      role: "owner",
      createdAt: Date.now(),
    });
    await audit(ctx, {
      organizationId,
      actorUserId: userId,
      action: "organization.created",
      targetType: "organization",
      targetId: organizationId,
    });
    return organizationId;
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const { userId } = await requireUser(ctx);
    const name = cleanText(args.name, "Workspace name", 2, 80);
    const baseSlug = slugify(name);
    let slug = baseSlug;
    for (
      let suffix = 2;
      await ctx.db
        .query("organizations")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      suffix += 1
    )
      slug = `${baseSlug}-${suffix}`;
    const organizationId = await ctx.db.insert("organizations", {
      name,
      slug,
      createdBy: userId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("memberships", {
      organizationId,
      userId,
      role: "owner",
      createdAt: Date.now(),
    });
    await audit(ctx, {
      organizationId,
      actorUserId: userId,
      action: "organization.created",
      targetType: "organization",
      targetId: organizationId,
    });
    return organizationId;
  },
});

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return Promise.all(
      memberships.map(async (membership) => ({
        membership,
        organization: await ctx.db.get(membership.organizationId),
      })),
    );
  },
});

export const members = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireMembership(ctx, args.organizationId);
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    return Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return {
          ...membership,
          name: user?.name ?? "Unknown",
          email: user?.email ?? "",
        };
      }),
    );
  },
});

export const invite = mutation({
  args: {
    organizationId: v.id("organizations"),
    email: v.string(),
    role,
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireMembership(
      ctx,
      args.organizationId,
      "admin",
    );
    if (args.role === "owner")
      throw new ConvexError("Owner role cannot be invited.");
    const email = cleanEmail(args.email)!;
    const invitationId = await ctx.db.insert("invitations", {
      organizationId: args.organizationId,
      email,
      role: args.role,
      tokenHash: args.tokenHash,
      invitedBy: userId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });
    await audit(ctx, {
      organizationId: args.organizationId,
      actorUserId: userId,
      action: "member.invited",
      targetType: "invitation",
      targetId: invitationId,
      metadata: { email, role: args.role },
    });
    return invitationId;
  },
});

export const acceptInvitation = mutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const { userId, user } = await requireUser(ctx);
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.expiresAt < Date.now()
    )
      throw new ConvexError("Invitation is invalid or expired.");
    if (user.email?.toLowerCase() !== invitation.email)
      throw new ConvexError("Sign in with the invited email address.");
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", invitation.organizationId).eq("userId", userId),
      )
      .unique();
    if (!existing)
      await ctx.db.insert("memberships", {
        organizationId: invitation.organizationId,
        userId,
        role: invitation.role,
        createdAt: Date.now(),
      });
    await ctx.db.patch(invitation._id, { acceptedAt: Date.now() });
    await audit(ctx, {
      organizationId: invitation.organizationId,
      actorUserId: userId,
      action: "member.joined",
      targetType: "membership",
      targetId: userId,
    });
    return invitation.organizationId;
  },
});

export const removeMember = mutation({
  args: { membershipId: v.id("memberships") },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.membershipId);
    if (!target) throw new ConvexError("Membership not found.");
    const { userId, membership: actor } = await requireMembership(
      ctx,
      target.organizationId,
      "admin",
    );
    if (target.role === "owner")
      throw new ConvexError("Workspace owner cannot be removed.");
    if (target.role === "admin" && actor.role !== "owner")
      throw new ConvexError("Only the owner can remove an admin.");
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("organizationId", target.organizationId))
      .collect();
    for (const project of projects) {
      const projectMembership = await ctx.db
        .query("projectMemberships")
        .withIndex("by_project_user", (q) =>
          q.eq("projectId", project._id).eq("userId", target.userId),
        )
        .unique();
      if (projectMembership?.role === "admin") {
        const otherAdmins = (
          await ctx.db
            .query("projectMemberships")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .collect()
        ).filter(
          (membership) =>
            membership.role === "admin" && membership._id !== projectMembership._id,
        );
        if (!otherAdmins.length)
          throw new ConvexError(
            `Transfer admin access for ${project.name} before removing this member.`,
          );
      }
      if (projectMembership) await ctx.db.delete(projectMembership._id);
    }
    await ctx.db.delete(target._id);
    await audit(ctx, {
      organizationId: target.organizationId,
      actorUserId: userId,
      action: "member.removed",
      targetType: "membership",
      targetId: target._id,
      metadata: { userId: target.userId },
    });
  },
});
