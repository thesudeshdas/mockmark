import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { audit, requireProject, requireUser } from "./lib/authz";
import { hashToken } from "./lib/tokens";
import { cleanEmail } from "./lib/validation";

const projectRole = v.union(
  v.literal("admin"),
  v.literal("commenter"),
  v.literal("viewer"),
);
const roleRank = { viewer: 0, commenter: 1, admin: 2 } as const;

function cleanOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConvexError("Enter a valid HTTP(S) origin.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== value)
    throw new ConvexError("Enter a valid HTTP(S) origin.");
  return url.origin;
}

export const members = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    const memberships = await ctx.db
      .query("projectMemberships")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        return { ...membership, name: user?.name ?? "Unknown", email: user?.email ?? "" };
      }),
    );
  },
});

export const invitations = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const { project } = await requireProject(ctx, args.projectId, "admin");
    const items = await ctx.db
      .query("projectInvitations")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    return items.map((invitation) => ({
      ...invitation,
      projectName: project.name,
      status: invitationStatus(invitation),
      deliveryAttemptCount: invitation.deliveryAttemptCount ?? 0,
    }));
  },
});

export const requestInvitation = mutation({
  args: {
    projectId: v.id("projects"),
    email: v.string(),
    role: projectRole,
    rawToken: v.string(),
  },
  handler: async (ctx, args) => {
    const { project, userId } = await requireProject(ctx, args.projectId, "admin");
    const email = cleanEmail(args.email)!;
    assertInviteToken(args.rawToken);
    const existing = (await ctx.db
      .query("projectInvitations")
      .withIndex("by_project_email", (q) =>
        q.eq("projectId", project._id).eq("email", email),
      )
      .collect()).find(isActiveInvitation);
    if (existing)
      throw new ConvexError("An active invitation already exists. Resend or revoke it instead.");
    const invitationId = await ctx.db.insert("projectInvitations", {
      projectId: project._id,
      organizationId: project.organizationId,
      email,
      role: args.role,
      tokenHash: await hashToken(args.rawToken),
      invitedBy: userId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      deliveryStatus: "pending",
      deliveryAttemptCount: 1,
      createdAt: Date.now(),
    });
    const attemptId = await createDeliveryAttempt(ctx, invitationId, 1);
    await ctx.scheduler.runAfter(0, internal.invitationEmails.deliver, {
      attemptId,
      scope: "project",
      invitationId,
      rawToken: args.rawToken,
    });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "project_member.invited",
      targetType: "projectInvitation",
      targetId: invitationId,
      metadata: { email, role: args.role },
    });
    return invitationId;
  },
});

export const resendInvitation = mutation({
  args: { invitationId: v.id("projectInvitations"), rawToken: v.string() },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new ConvexError("Invitation not found.");
    const { project, userId } = await requireProject(ctx, invitation.projectId, "admin");
    if (invitation.acceptedAt || invitation.revokedAt)
      throw new ConvexError("Only pending invitations can be resent.");
    assertInviteToken(args.rawToken);
    const deliveryAttemptCount = (invitation.deliveryAttemptCount ?? 0) + 1;
    await ctx.db.patch(invitation._id, {
      tokenHash: await hashToken(args.rawToken),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      expiredAt: undefined,
      deliveryStatus: "pending",
      deliveryAttemptCount,
      lastDeliveryError: undefined,
    });
    const attemptId = await createDeliveryAttempt(ctx, invitation._id, deliveryAttemptCount);
    await ctx.scheduler.runAfter(0, internal.invitationEmails.deliver, {
      attemptId,
      scope: "project",
      invitationId: invitation._id,
      rawToken: args.rawToken,
    });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "project_invitation.resent",
      targetType: "projectInvitation",
      targetId: invitation._id,
      metadata: { email: invitation.email, attempt: deliveryAttemptCount },
    });
  },
});

export const revokeInvitation = mutation({
  args: { invitationId: v.id("projectInvitations") },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new ConvexError("Invitation not found.");
    const { project, userId } = await requireProject(ctx, invitation.projectId, "admin");
    if (invitation.acceptedAt) throw new ConvexError("Accepted invitations cannot be revoked.");
    if (!invitation.revokedAt) await ctx.db.patch(invitation._id, { revokedAt: Date.now() });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "project_invitation.revoked",
      targetType: "projectInvitation",
      targetId: invitation._id,
      metadata: { email: invitation.email },
    });
  },
});

export const acceptInvitation = mutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const { userId, user } = await requireUser(ctx);
    const invitation = await ctx.db
      .query("projectInvitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt < Date.now())
      throw new ConvexError("Invitation is invalid or expired.");
    if (user.email?.toLowerCase() !== invitation.email)
      throw new ConvexError("Sign in with the invited email address.");
    const project = await ctx.db.get(invitation.projectId);
    if (!project || project.deletedAt || project.organizationId !== invitation.organizationId)
      throw new ConvexError("Invitation is invalid or expired.");
    const workspaceMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", invitation.organizationId).eq("userId", userId),
      )
      .unique();
    if (!workspaceMembership)
      await ctx.db.insert("memberships", {
        organizationId: invitation.organizationId,
        userId,
        role: "viewer",
        createdAt: Date.now(),
      });
    const existing = await ctx.db
      .query("projectMemberships")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", invitation.projectId).eq("userId", userId),
      )
      .unique();
    if (existing && roleRank[invitation.role] > roleRank[existing.role])
      await ctx.db.patch(existing._id, { role: invitation.role });
    else if (!existing)
      await ctx.db.insert("projectMemberships", {
        projectId: invitation.projectId,
        userId,
        role: invitation.role,
        addedBy: invitation.invitedBy,
        createdAt: Date.now(),
      });
    await ctx.db.patch(invitation._id, { acceptedAt: Date.now() });
    await audit(ctx, {
      organizationId: invitation.organizationId,
      projectId: invitation.projectId,
      actorUserId: userId,
      action: "project_invitation.accepted",
      targetType: "projectInvitation",
      targetId: invitation._id,
      metadata: { email: invitation.email, role: invitation.role },
    });
    await audit(ctx, {
      organizationId: invitation.organizationId,
      projectId: invitation.projectId,
      actorUserId: userId,
      action: "project_member.joined",
      targetType: "projectMembership",
      targetId: userId,
      metadata: { role: invitation.role },
    });
    return invitation.projectId;
  },
});

function invitationStatus(invitation: {
  acceptedAt?: number;
  revokedAt?: number;
  expiredAt?: number;
  expiresAt: number;
  deliveryStatus?: "pending" | "sent" | "delivered" | "bounced" | "failed";
}) {
  if (invitation.acceptedAt) return "accepted" as const;
  if (invitation.revokedAt) return "revoked" as const;
  if (invitation.expiredAt || invitation.expiresAt < Date.now()) return "expired" as const;
  return invitation.deliveryStatus === "sent" ? "pending" as const : invitation.deliveryStatus ?? "pending";
}

function isActiveInvitation(invitation: { acceptedAt?: number; revokedAt?: number; expiresAt: number }) {
  return !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt >= Date.now();
}

function assertInviteToken(token: string) {
  if (!/^mmv_[A-Za-z0-9_-]{8,128}$/.test(token))
    throw new ConvexError("Invitation token is invalid.");
}

async function createDeliveryAttempt(ctx: any, invitationId: string, attempt: number) {
  return ctx.db.insert("invitationDeliveryAttempts", {
    scope: "project",
    invitationId,
    attempt,
    idempotencyKey: `project-invitation/${invitationId}/${attempt}`,
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export const origins = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    return ctx.db
      .query("projectOrigins")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

export const addOrigin = mutation({
  args: { projectId: v.id("projects"), origin: v.string() },
  handler: async (ctx, args) => {
    const { project, userId } = await requireProject(ctx, args.projectId, "admin");
    const origin = cleanOrigin(args.origin);
    const existing = await ctx.db
      .query("projectOrigins")
      .withIndex("by_project_origin", (q) =>
        q.eq("projectId", project._id).eq("origin", origin),
      )
      .unique();
    if (existing) return existing._id;
    const originId = await ctx.db.insert("projectOrigins", {
      projectId: project._id,
      origin,
      createdBy: userId,
      createdAt: Date.now(),
    });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "project_origin.added",
      targetType: "projectOrigin",
      targetId: originId,
      metadata: { origin },
    });
    return originId;
  },
});

export const removeOrigin = mutation({
  args: { originId: v.id("projectOrigins") },
  handler: async (ctx, args) => {
    const origin = await ctx.db.get(args.originId);
    if (!origin) throw new ConvexError("Mock origin not found.");
    const { project, userId } = await requireProject(ctx, origin.projectId, "admin");
    await ctx.db.delete(origin._id);
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "project_origin.removed",
      targetType: "projectOrigin",
      targetId: origin._id,
      metadata: { origin: origin.origin },
    });
  },
});

export const setRole = mutation({
  args: { projectId: v.id("projects"), userId: v.id("users"), role: projectRole },
  handler: async (ctx, args) => {
    const { project, userId: actorUserId } = await requireProject(ctx, args.projectId, "admin");
    const workspaceMembership = await ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q) =>
        q.eq("organizationId", project.organizationId).eq("userId", args.userId),
      )
      .unique();
    if (!workspaceMembership) throw new ConvexError("User must belong to this workspace.");
    const existing = await ctx.db
      .query("projectMemberships")
      .withIndex("by_project_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId),
      )
      .unique();
    if (existing?.role === "admin" && args.role !== "admin") {
      const admins = (
        await ctx.db
          .query("projectMemberships")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .collect()
      ).filter((membership) => membership.role === "admin");
      if (admins.length === 1)
        throw new ConvexError("Project must keep at least one admin.");
    }
    if (existing) await ctx.db.patch(existing._id, { role: args.role });
    else
      await ctx.db.insert("projectMemberships", {
        projectId: args.projectId,
        userId: args.userId,
        role: args.role,
        addedBy: actorUserId,
        createdAt: Date.now(),
      });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId,
      action: "project_member.role_set",
      targetType: "projectMembership",
      targetId: args.userId,
      metadata: { role: args.role },
    });
  },
});

export const remove = mutation({
  args: { membershipId: v.id("projectMemberships") },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.membershipId);
    if (!target) throw new ConvexError("Project membership not found.");
    const { project, userId } = await requireProject(ctx, target.projectId, "admin");
    if (target.role === "admin") {
      const admins = (
        await ctx.db
          .query("projectMemberships")
          .withIndex("by_project", (q) => q.eq("projectId", target.projectId))
          .collect()
      ).filter((membership) => membership.role === "admin");
      if (admins.length === 1) throw new ConvexError("Project must keep at least one admin.");
    }
    await ctx.db.delete(target._id);
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "project_member.removed",
      targetType: "projectMembership",
      targetId: target._id,
      metadata: { userId: target.userId },
    });
  },
});
