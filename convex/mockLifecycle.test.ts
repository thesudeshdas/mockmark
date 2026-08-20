/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.js", "./**/*.ts", "!./**/*.d.ts"]);

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { name: "Owner", email: "owner@example.com" });
    const commenterId = await ctx.db.insert("users", { name: "Commenter", email: "commenter@example.com" });
    const viewerId = await ctx.db.insert("users", { name: "Viewer", email: "viewer@example.com" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Workspace",
      slug: "workspace",
      createdBy: ownerId,
      createdAt: 1,
    });
    for (const [userId, role] of [[ownerId, "owner"], [commenterId, "commenter"], [viewerId, "viewer"]] as const)
      await ctx.db.insert("memberships", { organizationId, userId, role, createdAt: 1 });
    const projectId = await ctx.db.insert("projects", {
      organizationId,
      name: "Project",
      slug: "project",
      projectKey: `mmp_${"a".repeat(36)}`,
      createdBy: ownerId,
      createdAt: 1,
    });
    for (const [userId, role] of [[ownerId, "admin"], [commenterId, "commenter"], [viewerId, "viewer"]] as const)
      await ctx.db.insert("projectMemberships", { projectId, userId, role, addedBy: ownerId, createdAt: 1 });
    const deployTokenId = await ctx.db.insert("accessTokens", {
      projectId,
      kind: "deployment",
      label: "Deploy",
      tokenHash: "hash",
      tokenPrefix: "mmd_seed",
      createdBy: ownerId,
      createdAt: 1,
    });
    const deploymentId = await ctx.db.insert("mockDeployments", {
      projectId,
      deploymentKey: "mmb_current",
      fileCount: 2,
      totalBytes: 24,
      htmlPaths: ["index.html", "approved.html"],
      manifest: ["index.html", "approved.html"].map((path, index) => ({
        path,
        contentType: "text/html",
        size: 12,
        sha256: String(index + 1).repeat(64),
      })),
      createdByTokenId: deployTokenId,
      createdAt: 1,
      completedAt: 2,
    });
    return { ownerId, commenterId, viewerId, projectId, deploymentId, projectKey: `mmp_${"a".repeat(36)}` };
  });
}

describe("mock lifecycle", () => {
  test("enforces role permissions and automatic review transitions", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, commenterId, viewerId, projectId, deploymentId, projectKey } = await seed(t);
    const owner = t.withIdentity({ subject: ownerId });
    const commenter = t.withIdentity({ subject: commenterId });
    const viewer = t.withIdentity({ subject: viewerId });

    const initial = await owner.query(api.deployments.browse, { deploymentId });
    expect(initial.projectRole).toBe("admin");
    expect(initial.files.map((file) => file.status)).toEqual(["mocking", "mocking"]);

    await expect(viewer.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "index.html",
      status: "ready_to_review",
    })).rejects.toThrow(/project not found/i);
    await commenter.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "index.html",
      status: "ready_to_review",
    });
    await expect(commenter.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "index.html",
      status: "reviewed",
    })).rejects.toThrow(/project not found/i);
    await expect(owner.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "index.html",
      status: "in_review",
    })).rejects.toThrow(/starts automatically/i);
    await expect(commenter.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "not-deployed.html",
      status: "ready_to_review",
    })).rejects.toThrow(/mock not found/i);

    const { token } = await commenter.action(api.previewSessions.create, { projectId });
    const threadId = await t.action(api.publicApi.createThread, {
      token,
      projectKey,
      pageKey: "hosted:index.html",
      path: "/hosted/session/mmb_current/index.html",
      title: "Index",
      x: 0.2,
      y: 0.3,
      viewportWidth: 1200,
      viewportHeight: 800,
      body: "Review this.",
    });
    let result = await owner.query(api.deployments.browse, { deploymentId });
    expect(result.files.find((file) => file.path === "index.html")?.status).toBe("in_review");

    await owner.mutation(api.publicApi.deleteThreadForDashboard, { threadId: threadId as Id<"threads"> });
    result = await owner.query(api.deployments.browse, { deploymentId });
    expect(result.files.find((file) => file.path === "index.html")?.status).toBe("ready_to_review");
  });

  test("allows admin approval, archive, and restore including approval without comments", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, commenterId, projectId, deploymentId } = await seed(t);
    const owner = t.withIdentity({ subject: ownerId });
    const commenter = t.withIdentity({ subject: commenterId });

    await commenter.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "approved.html",
      status: "ready_to_review",
    });
    await owner.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "approved.html",
      status: "reviewed",
    });
    await owner.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "approved.html",
      status: "archived",
    });
    await expect(commenter.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "approved.html",
      status: "mocking",
    })).rejects.toThrow(/only project admins/i);
    await owner.mutation(api.mockLifecycle.setStatus, {
      projectId,
      path: "approved.html",
      status: "mocking",
    });

    const result = await owner.query(api.deployments.browse, { deploymentId });
    expect(result.files.find((file) => file.path === "approved.html")?.status).toBe("mocking");
    const auditEvents = await t.run((ctx) =>
      ctx.db.query("auditEvents").withIndex("by_project", (q) => q.eq("projectId", projectId)).collect(),
    );
    expect(auditEvents.filter((event) => event.action === "mock.status_changed")).toHaveLength(4);
  });
});
