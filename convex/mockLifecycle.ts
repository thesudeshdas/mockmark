import { ConvexError, v } from "convex/values";
import type { GenericMutationCtx } from "convex/server";
import { mutation } from "./_generated/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import { audit, requireProject } from "./lib/authz";

export const mockStatus = v.union(
  v.literal("mocking"),
  v.literal("ready_to_review"),
  v.literal("in_review"),
  v.literal("reviewed"),
  v.literal("archived"),
);

export type MockStatus = Doc<"mockRecords">["status"];
type MutationCtx = GenericMutationCtx<DataModel>;

export const setStatus = mutation({
  args: {
    projectId: v.id("projects"),
    path: v.string(),
    status: mockStatus,
  },
  handler: async (ctx, args) => {
    const path = normalizeMockPath(args.path);
    if (args.status === "in_review")
      throw new ConvexError("In review starts automatically with the first comment.");
    const access = await requireProject(
      ctx,
      args.projectId,
      args.status === "reviewed" || args.status === "archived" ? "admin" : "commenter",
    );
    const current = await findMockRecord(ctx, args.projectId, path);
    if (!current && !(await deployedMockExists(ctx, args.projectId, path)))
      throw new ConvexError("Mock not found.");
    if (current?.status === "archived" && access.membership.role !== "admin")
      throw new ConvexError("Only project admins can restore archived mocks.");
    const previousStatus = current?.status ?? "mocking";
    if (previousStatus === args.status) return current?._id ?? null;
    const now = Date.now();
    const recordId = current
      ? (await ctx.db.patch(current._id, {
          status: args.status,
          statusChangedBy: access.userId,
          updatedAt: now,
        }), current._id)
      : await ctx.db.insert("mockRecords", {
          projectId: args.projectId,
          path,
          status: args.status,
          statusChangedBy: access.userId,
          createdAt: now,
          updatedAt: now,
        });
    await auditStatusChange(ctx, {
      project: access.project,
      actorUserId: access.userId,
      actorName: access.user.name,
      recordId,
      path,
      previousStatus,
      nextStatus: args.status,
      reason: "manual",
    });
    return recordId;
  },
});

export async function ensureMockRecords(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  paths: string[],
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("mockRecords")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  const existingPaths = new Set(existing.map((record) => record.path));
  for (const rawPath of paths) {
    const path = normalizeMockPath(rawPath);
    if (existingPaths.has(path)) continue;
    await ctx.db.insert("mockRecords", {
      projectId,
      path,
      status: "mocking",
      createdAt: now,
      updatedAt: now,
    });
    existingPaths.add(path);
  }
}

export async function markMockInReview(
  ctx: MutationCtx,
  args: {
    project: Doc<"projects">;
    path: string;
    actorUserId: Id<"users">;
    actorName?: string;
  },
) {
  const path = normalizeMockPath(args.path);
  const current = await findMockRecord(ctx, args.project._id, path);
  const previousStatus = current?.status ?? "mocking";
  if (previousStatus !== "mocking" && previousStatus !== "ready_to_review") return;
  const now = Date.now();
  const recordId = current
    ? (await ctx.db.patch(current._id, {
        status: "in_review",
        statusChangedBy: args.actorUserId,
        updatedAt: now,
      }), current._id)
    : await ctx.db.insert("mockRecords", {
        projectId: args.project._id,
        path,
        status: "in_review",
        statusChangedBy: args.actorUserId,
        createdAt: now,
        updatedAt: now,
      });
  await auditStatusChange(ctx, {
    project: args.project,
    actorUserId: args.actorUserId,
    actorName: args.actorName,
    recordId,
    path,
    previousStatus,
    nextStatus: "in_review",
    reason: "first_comment",
  });
}

export async function restoreReadyWhenReviewEmpty(
  ctx: MutationCtx,
  args: {
    project: Doc<"projects">;
    path: string;
    actorUserId: Id<"users">;
    actorName?: string;
  },
) {
  const path = normalizeMockPath(args.path);
  const current = await findMockRecord(ctx, args.project._id, path);
  if (current?.status !== "in_review") return;
  const pages = await ctx.db
    .query("pages")
    .withIndex("by_project", (q) => q.eq("projectId", args.project._id))
    .collect();
  const matchingPages = pages.filter((page) => mockPathFromPageKey(page.pageKey) === path);
  for (const page of matchingPages) {
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_page", (q) => q.eq("pageId", page._id))
      .collect();
    if (threads.some((thread) => !thread.deletedAt)) return;
  }
  await ctx.db.patch(current._id, {
    status: "ready_to_review",
    statusChangedBy: args.actorUserId,
    updatedAt: Date.now(),
  });
  await auditStatusChange(ctx, {
    project: args.project,
    actorUserId: args.actorUserId,
    actorName: args.actorName,
    recordId: current._id,
    path,
    previousStatus: "in_review",
    nextStatus: "ready_to_review",
    reason: "last_comment_deleted",
  });
}

export function mockPathFromPageKey(pageKey: string) {
  if (!pageKey.startsWith("hosted:")) return null;
  const identity = pageKey.slice("hosted:".length);
  if (!identity.startsWith("mmb_")) return normalizeMockPath(identity);
  const separator = identity.indexOf(":");
  return separator < 0 ? null : normalizeMockPath(identity.slice(separator + 1));
}

function normalizeMockPath(path: string) {
  const normalized = path.trim().replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.length > 500 ||
    normalized.includes("\\") ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  ) throw new ConvexError("Mock path is invalid.");
  return normalized;
}

async function findMockRecord(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  path: string,
) {
  return ctx.db
    .query("mockRecords")
    .withIndex("by_project_path", (q) => q.eq("projectId", projectId).eq("path", path))
    .unique();
}

async function deployedMockExists(
  ctx: MutationCtx,
  projectId: Id<"projects">,
  path: string,
) {
  const deployments = await ctx.db
    .query("mockDeployments")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .collect();
  return deployments.some((deployment) => deployment.completedAt && deployment.htmlPaths.includes(path));
}

async function auditStatusChange(
  ctx: MutationCtx,
  args: {
    project: Doc<"projects">;
    actorUserId: Id<"users">;
    actorName?: string;
    recordId: Id<"mockRecords">;
    path: string;
    previousStatus: MockStatus;
    nextStatus: MockStatus;
    reason: "manual" | "first_comment" | "last_comment_deleted";
  },
) {
  await audit(ctx, {
    organizationId: args.project.organizationId,
    projectId: args.project._id,
    actorUserId: args.actorUserId,
    actorName: args.actorName,
    action: "mock.status_changed",
    targetType: "mockRecord",
    targetId: args.recordId,
    metadata: {
      path: args.path,
      previousStatus: args.previousStatus,
      nextStatus: args.nextStatus,
      reason: args.reason,
    },
  });
}
