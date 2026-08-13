import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";

type Ctx = GenericQueryCtx<DataModel> | GenericMutationCtx<DataModel>;
type Role = Doc<"memberships">["role"];
type ProjectRole = Doc<"projectMemberships">["role"];
const rank: Record<Role, number> = {
  viewer: 0,
  commenter: 1,
  admin: 2,
  owner: 3,
};
const projectRank: Record<ProjectRole, number> = {
  viewer: 0,
  commenter: 1,
  admin: 2,
};

export async function requireUser(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Authentication required.");
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("User not found.");
  return { userId, user };
}

export async function requireMembership(
  ctx: Ctx,
  organizationId: Id<"organizations">,
  minimum: Role = "viewer",
) {
  const { userId, user } = await requireUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId),
    )
    .unique();
  if (!membership || rank[membership.role] < rank[minimum])
    throw new ConvexError("You do not have permission for this workspace.");
  return { userId, user, membership };
}

export async function requireProject(
  ctx: Ctx,
  projectId: Id<"projects">,
  minimum: ProjectRole = "viewer",
) {
  const project = await ctx.db.get(projectId);
  if (!project || project.deletedAt)
    throw new ConvexError("Project not found.");
  const { userId, user } = await requireUser(ctx);
  const workspaceMembership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) =>
      q.eq("organizationId", project.organizationId).eq("userId", userId),
    )
    .unique();
  const projectMembership = await ctx.db
    .query("projectMemberships")
    .withIndex("by_project_user", (q) =>
      q.eq("projectId", projectId).eq("userId", userId),
    )
    .unique();
  if (
    !workspaceMembership ||
    !projectMembership ||
    projectRank[projectMembership.role] < projectRank[minimum]
  )
    throw new ConvexError("Project not found.");
  return { project, userId, user, membership: projectMembership, workspaceMembership };
}

export async function audit(
  ctx: GenericMutationCtx<DataModel>,
  args: {
    organizationId: Id<"organizations">;
    projectId?: Id<"projects">;
    actorUserId?: Id<"users">;
    actorName?: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: unknown;
  },
) {
  await ctx.db.insert("auditEvents", { ...args, createdAt: Date.now() });
}
