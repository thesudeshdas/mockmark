/// <reference types="vite/client" />
import { createHash } from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import { matchesStorageMetadata } from "./deployments";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.js", "./**/*.ts", "!./**/*.d.ts"]);
const deployToken = `mmd_${"d".repeat(64)}`;
const installToken = `mmi_${"i".repeat(64)}`;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { name: "Owner", email: "owner@example.com" });
    const reviewerId = await ctx.db.insert("users", { name: "Reviewer", email: "reviewer@example.com" });
    const outsiderId = await ctx.db.insert("users", { name: "Outsider", email: "outsider@example.com" });
    const organizationId = await ctx.db.insert("organizations", { name: "Workspace", slug: "workspace", createdBy: ownerId, createdAt: 1 });
    for (const [userId, role] of [[ownerId, "owner"], [reviewerId, "viewer"], [outsiderId, "viewer"]] as const)
      await ctx.db.insert("memberships", { organizationId, userId, role, createdAt: 1 });
    const projectId = await ctx.db.insert("projects", { organizationId, name: "Project", slug: "project", projectKey: `mmp_${"a".repeat(36)}`, createdBy: ownerId, createdAt: 1 });
    const siblingId = await ctx.db.insert("projects", { organizationId, name: "Sibling", slug: "sibling", projectKey: `mmp_${"b".repeat(36)}`, createdBy: ownerId, createdAt: 1 });
    for (const [targetProjectId, userId, role] of [[projectId, ownerId, "admin"], [projectId, reviewerId, "viewer"], [siblingId, ownerId, "admin"]] as const)
      await ctx.db.insert("projectMemberships", { projectId: targetProjectId, userId, role, addedBy: ownerId, createdAt: 1 });
    const deployTokenId = await ctx.db.insert("accessTokens", { projectId, kind: "deployment", label: "Deploy", tokenHash: hash(deployToken), tokenPrefix: deployToken.slice(0, 12), createdBy: ownerId, createdAt: 1 });
    await ctx.db.insert("accessTokens", { projectId, kind: "installation", label: "Feedback", tokenHash: hash(installToken), tokenPrefix: installToken.slice(0, 12), createdBy: ownerId, createdAt: 1 });
    const deploymentId = await ctx.db.insert("mockDeployments", {
      projectId,
      deploymentKey: "mmb_hosted",
      fileCount: 1,
      totalBytes: 12,
      htmlPaths: ["index.html"],
      manifest: [{ path: "index.html", contentType: "text/html", size: 12, sha256: "a".repeat(64) }],
      createdByTokenId: deployTokenId,
      createdAt: 1,
      completedAt: 2,
    });
    return { ownerId, reviewerId, outsiderId, projectId, siblingId, deploymentId, deployTokenId, projectKey: `mmp_${"a".repeat(36)}`, siblingKey: `mmp_${"b".repeat(36)}` };
  });
}

describe("hosted mock deployments", () => {
  test("matches uploaded storage metadata before completing a deployment", () => {
    const expected = { size: 12, sha256: "a".repeat(64) };
    expect(matchesStorageMetadata({ ...expected, sha256: expected.sha256.toUpperCase() }, expected)).toBe(true);
    expect(matchesStorageMetadata({ ...expected, size: 13 }, expected)).toBe(false);
    expect(matchesStorageMetadata(null, expected)).toBe(false);
  });

  test("accepts only project-scoped deployment credentials", async () => {
    const t = convexTest(schema, modules);
    const { projectKey, siblingKey } = await seed(t);
    await expect(t.action(api.deployments.validateToken, { token: deployToken, projectKey })).resolves.toMatchObject({ project: { key: projectKey } });
    await expect(t.action(api.deployments.validateToken, { token: installToken, projectKey })).rejects.toThrow(/invalid or expired/i);
    await expect(t.action(api.deployments.validateToken, { token: deployToken, projectKey: siblingKey })).rejects.toThrow(/invalid or expired/i);
  });

  test("validates deployment limits before issuing upload URLs", async () => {
    const t = convexTest(schema, modules);
    const { projectKey } = await seed(t);
    const valid = [{ path: "index.html", contentType: "text/html", size: 12, sha256: "a".repeat(64) }];
    await expect(t.action(api.deployments.begin, { token: deployToken, projectKey, files: valid })).resolves.toMatchObject({ deploymentKey: expect.stringMatching(/^mmb_/) });
    await expect(t.action(api.deployments.begin, { token: deployToken, projectKey, files: [{ ...valid[0], path: "../index.html" }] })).rejects.toThrow(/invalid or duplicate path/i);
    await expect(t.action(api.deployments.begin, { token: deployToken, projectKey, files: [{ ...valid[0], size: 8 * 1024 * 1024 }] })).resolves.toMatchObject({ deploymentKey: expect.stringMatching(/^mmb_/) });
    await expect(t.action(api.deployments.begin, { token: deployToken, projectKey, files: [{ ...valid[0], size: 16 * 1024 * 1024 }] })).rejects.toThrow(/size limit/i);
    await expect(t.action(api.deployments.begin, {
      token: deployToken,
      projectKey,
      files: Array.from({ length: 11 }, (_, index) => ({
        ...valid[0],
        path: `${index}.html`,
        size: 14 * 1024 * 1024,
      })),
    })).rejects.toThrow(/total size limit/i);
  });

  test("share access requires explicit project membership", async () => {
    const t = convexTest(schema, modules);
    const { reviewerId, outsiderId } = await seed(t);
    await expect(t.withIdentity({ subject: reviewerId }).action(api.previewSessions.createForDeployment, { deploymentKey: "mmb_hosted" })).resolves.toMatchObject({ token: expect.stringMatching(/^mms_/), projectKey: `mmp_${"a".repeat(36)}` });
    await expect(t.withIdentity({ subject: outsiderId }).action(api.previewSessions.createForDeployment, { deploymentKey: "mmb_hosted" })).rejects.toThrow(/project not found/i);
  });

  test("deployment listings expose reviewable pages but not supporting asset manifests", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, projectId } = await seed(t);
    const result = await t.withIdentity({ subject: ownerId }).query(api.deployments.list, { projectId });

    expect(result[0]).toMatchObject({ pageCount: 1, primaryHtmlPath: "index.html" });
    expect(result[0]).not.toHaveProperty("manifest");
    expect(result[0]).not.toHaveProperty("htmlPaths");
    expect(result[0]).not.toHaveProperty("fileCount");
  });

  test("latest returns only the newest completed mock library", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, projectId } = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("mockDeployments", {
        projectId,
        deploymentKey: "mmb_uploading",
        fileCount: 1,
        totalBytes: 12,
        htmlPaths: ["draft.html"],
        manifest: [{ path: "draft.html", contentType: "text/html", size: 12, sha256: "e".repeat(64) }],
        createdByTokenId: (await ctx.db.query("accessTokens").withIndex("by_project", (q) => q.eq("projectId", projectId)).first())!._id,
        createdAt: 3,
      });
    });

    await expect(t.withIdentity({ subject: ownerId }).query(api.deployments.latest, { projectId })).resolves.toMatchObject({ deploymentKey: "mmb_hosted" });
  });

  test("browses deployment-root files and includes zero-comment HTML pages", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, projectId, deploymentId } = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(deploymentId, {
        label: "Today experience",
        fileCount: 4,
        htmlPaths: ["today/index.html", "today/states/empty.html"],
        manifest: [
          { path: "today/index.html", contentType: "text/html", size: 12, sha256: "a".repeat(64) },
          { path: "today/states/empty.html", contentType: "text/html", size: 12, sha256: "b".repeat(64) },
          { path: "today/assets/app.css", contentType: "text/css; charset=utf-8", size: 12, sha256: "c".repeat(64) },
          { path: "shared/logo.svg", contentType: "image/svg+xml", size: 12, sha256: "d".repeat(64) },
        ],
      });
      const pageId = await ctx.db.insert("pages", {
        projectId,
        pageKey: "hosted:mmb_hosted:today/index.html",
        path: "today/index.html",
        title: "Today",
        lastSeenAt: 1,
      });
      for (const [resolvedAt, deletedAt] of [[undefined, undefined], [2, undefined], [undefined, 3]] as const)
        await ctx.db.insert("threads", {
          projectId,
          pageId,
          x: 0.5,
          y: 0.5,
          viewportWidth: 1000,
          viewportHeight: 800,
          authorName: "Owner",
          createdAt: 1,
          updatedAt: 1,
          resolvedAt,
          deletedAt,
        });
      const historicalPageId = await ctx.db.insert("pages", {
        projectId,
        pageKey: "hosted:mmb_older:today/index.html",
        path: "today/index.html",
        title: "Today old build",
        lastSeenAt: 0,
      });
      await ctx.db.insert("threads", {
        projectId,
        pageId: historicalPageId,
        x: 0.4,
        y: 0.4,
        viewportWidth: 1000,
        viewportHeight: 800,
        authorName: "Owner",
        createdAt: 0,
        updatedAt: 0,
      });
    });
    const result = await t.withIdentity({ subject: ownerId }).query(api.deployments.browse, { deploymentId });
    expect(result.files.map((file) => file.path)).toEqual(["today/index.html", "today/states/empty.html"]);
    expect(result.files[0]).toMatchObject({ conversations: 3, open: 2, resolved: 1 });
    expect(result.files[0].pageIds).toHaveLength(2);
    expect(result.files[1]).toMatchObject({ conversations: 0, open: 0, resolved: 0 });
    expect(result.files[1]).not.toHaveProperty("pageId");
  });

  test("completion prunes old deployment data but retains feedback conversations", async () => {
    const t = convexTest(schema, modules);
    const { projectId, projectKey, deploymentId, deployTokenId } = await seed(t);
    const { newDeploymentId, pageId, threadId, messageId, newStorageId } = await t.run(async (ctx) => {
      const oldStorageId = await ctx.storage.store(new Blob(["old mock html"]));
      await ctx.db.insert("mockAssets", {
        projectId,
        deploymentId,
        path: "index.html",
        storageId: oldStorageId,
        contentType: "text/html",
        size: 13,
        sha256: "b".repeat(64),
        createdAt: 2,
      });
      const pageId = await ctx.db.insert("pages", {
        projectId,
        pageKey: "hosted:mmb_hosted:index.html",
        path: "index.html",
        title: "Index",
        lastSeenAt: 2,
      });
      const threadId = await ctx.db.insert("threads", {
        projectId,
        pageId,
        x: 0.5,
        y: 0.5,
        viewportWidth: 1000,
        viewportHeight: 800,
        authorName: "Owner",
        createdAt: 2,
        updatedAt: 2,
      });
      const messageId = await ctx.db.insert("messages", {
        projectId,
        threadId,
        body: "Keep this conversation",
        authorName: "Owner",
        createdAt: 2,
      });
      const newStorageId = await ctx.storage.store(new Blob(["new mock html"]));
      const newDeploymentId = await ctx.db.insert("mockDeployments", {
        projectId,
        deploymentKey: "mmb_current",
        fileCount: 1,
        totalBytes: 13,
        htmlPaths: ["index.html"],
        manifest: [{ path: "index.html", contentType: "text/html", size: 13, sha256: "c".repeat(64) }],
        createdByTokenId: deployTokenId,
        createdAt: 3,
      });
      return { newDeploymentId, pageId, threadId, messageId, newStorageId };
    });

    await t.mutation(internal.deployments.completeWithToken, {
      tokenHash: hash(deployToken),
      projectKey,
      deploymentId: newDeploymentId,
      assets: [{ path: "index.html", contentType: "text/html", size: 13, sha256: "c".repeat(64), storageId: newStorageId }],
    });

    await t.run(async (ctx) => {
      expect(await ctx.db.get(deploymentId)).toBeNull();
      expect(await ctx.db.query("mockAssets").withIndex("by_deployment", (q) => q.eq("deploymentId", deploymentId)).collect()).toEqual([]);
      expect(await ctx.db.get(newDeploymentId)).toMatchObject({ completedAt: expect.any(Number) });
      expect(await ctx.db.get(pageId)).not.toBeNull();
      expect(await ctx.db.get(threadId)).not.toBeNull();
      expect(await ctx.db.get(messageId)).not.toBeNull();
      await expect(ctx.db.query("mockRecords").withIndex("by_project_path", (q) => q.eq("projectId", projectId).eq("path", "index.html")).unique()).resolves.toMatchObject({ status: "mocking" });
    });
  });

  test("hosted gateway never serves without a valid member session", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    const response = await t.fetch("/hosted/mms_invalid/mmb_hosted/index.html");
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
