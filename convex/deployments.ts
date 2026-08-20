import { ConvexError, v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { audit, requireProject } from "./lib/authz";
import { hashToken, randomToken } from "./lib/tokens";
import { hostedPageMatchesPath } from "./lib/hostedRuntime";
import { ensureMockRecords } from "./mockLifecycle";

const MAX_FILES = 200;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 150 * 1024 * 1024;
const fileFields = {
  path: v.string(),
  contentType: v.string(),
  size: v.number(),
  sha256: v.string(),
};
const fileSpec = v.object(fileFields);

export const validateToken = action({
  args: { token: v.string(), projectKey: v.string() },
  handler: async (ctx, args): Promise<{ project: { key: string; name: string } }> => {
    const tokenHash = await hashToken(args.token);
    return ctx.runQuery(internal.deployments.validateDeployAccess, {
      tokenHash,
      projectKey: args.projectKey,
    });
  },
});

export const begin = action({
  args: {
    token: v.string(),
    projectKey: v.string(),
    label: v.optional(v.string()),
    branch: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    files: v.array(fileSpec),
  },
  handler: async (ctx, args): Promise<{
    deploymentId: string;
    deploymentKey: string;
    uploads: Array<{ path: string; uploadUrl: string }>;
  }> => {
    const tokenHash = await hashToken(args.token);
    const deploymentKey = randomToken("mmb");
    const { token: _token, ...safeArgs } = args;
    return ctx.runMutation(internal.deployments.beginWithToken, {
      ...safeArgs,
      tokenHash,
      deploymentKey,
    });
  },
});

export const beginWithToken = internalMutation({
  args: {
    tokenHash: v.string(),
    projectKey: v.string(),
    deploymentKey: v.string(),
    label: v.optional(v.string()),
    branch: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    files: v.array(fileSpec),
  },
  handler: async (ctx, args) => {
    const { token, project } = await requireDeployAccess(ctx, args.tokenHash, args.projectKey);
    validateFiles(args.files);
    const deploymentId = await ctx.db.insert("mockDeployments", {
      projectId: project._id,
      deploymentKey: args.deploymentKey,
      label: args.label?.trim().slice(0, 100) || undefined,
      branch: args.branch?.slice(0, 200),
      commitSha: args.commitSha?.slice(0, 80),
      fileCount: args.files.length,
      totalBytes: args.files.reduce((sum, file) => sum + file.size, 0),
      htmlPaths: args.files.filter((file) => file.contentType === "text/html").map((file) => file.path),
      manifest: args.files,
      createdByTokenId: token._id,
      createdAt: Date.now(),
    });
    const uploads = await Promise.all(
      args.files.map(async (file) => ({ path: file.path, uploadUrl: await ctx.storage.generateUploadUrl() })),
    );
    return { deploymentId, deploymentKey: args.deploymentKey, uploads };
  },
});

export const complete = action({
  args: {
    token: v.string(),
    projectKey: v.string(),
    deploymentId: v.id("mockDeployments"),
    assets: v.array(v.object({ ...fileFields, storageId: v.id("_storage") })),
  },
  handler: async (ctx, args): Promise<{ deploymentKey: string; htmlPaths: string[] }> => {
    const tokenHash = await hashToken(args.token);
    const metadata = await Promise.all(
      args.assets.map((asset) => ctx.storage.getMetadata(asset.storageId)),
    );
    if (metadata.some((stored, index) => !matchesStorageMetadata(stored, args.assets[index])))
      throw new ConvexError("Uploaded file integrity check failed.");
    const { token: _token, ...safeArgs } = args;
    return ctx.runMutation(internal.deployments.completeWithToken, { ...safeArgs, tokenHash });
  },
});

export const completeWithToken = internalMutation({
  args: {
    tokenHash: v.string(),
    projectKey: v.string(),
    deploymentId: v.id("mockDeployments"),
    assets: v.array(v.object({ ...fileFields, storageId: v.id("_storage") })),
  },
  handler: async (ctx, args) => {
    const { token, project } = await requireDeployAccess(ctx, args.tokenHash, args.projectKey);
    const deployment = await ctx.db.get(args.deploymentId);
    if (!deployment || deployment.projectId !== project._id || deployment.createdByTokenId !== token._id || deployment.completedAt)
      throw new ConvexError("Deployment is invalid or already complete.");
    validateFiles(args.assets);
    const receivedManifest = args.assets.map(({ storageId: _storageId, ...file }) => file);
    if (JSON.stringify(receivedManifest) !== JSON.stringify(deployment.manifest))
      throw new ConvexError("Uploaded files do not match deployment plan.");
    for (const asset of args.assets) {
      await ctx.db.insert("mockAssets", {
        projectId: project._id,
        deploymentId: deployment._id,
        path: asset.path,
        storageId: asset.storageId,
        contentType: asset.contentType,
        size: asset.size,
        sha256: asset.sha256,
        createdAt: Date.now(),
      });
    }
    await ensureMockRecords(ctx, project._id, deployment.htmlPaths);
    await ctx.db.patch(deployment._id, { completedAt: Date.now() });
    await ctx.db.patch(token._id, { lastUsedAt: Date.now() });
    const prunedDeployments = await pruneSupersededDeployments(ctx, project._id, deployment._id);
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      action: "mock_deployment.completed",
      targetType: "mockDeployment",
      targetId: deployment._id,
      metadata: {
        deploymentKey: deployment.deploymentKey,
        fileCount: deployment.fileCount,
        prunedDeployments,
      },
    });
    return { deploymentKey: deployment.deploymentKey, htmlPaths: deployment.htmlPaths };
  },
});

export const pruneHistory = internalMutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const deployments = await ctx.db
      .query("mockDeployments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
    const current = deployments.find((deployment) => deployment.completedAt);
    if (!current) return { keptDeploymentId: null, prunedDeployments: 0 };
    return {
      keptDeploymentId: current._id,
      prunedDeployments: await pruneSupersededDeployments(ctx, args.projectId, current._id),
    };
  },
});

export const list = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    const deployments = await ctx.db.query("mockDeployments").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).order("desc").take(30);
    return deployments.map((deployment) => ({
      _id: deployment._id,
      deploymentKey: deployment.deploymentKey,
      label: deployment.label,
      branch: deployment.branch,
      commitSha: deployment.commitSha,
      pageCount: deployment.htmlPaths.length,
      primaryHtmlPath: deployment.htmlPaths[0],
      createdAt: deployment.createdAt,
      completedAt: deployment.completedAt,
    }));
  },
});

export const latest = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    const deployments = await ctx.db
      .query("mockDeployments")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(30);
    const deployment = deployments.find((item) => item.completedAt && item.htmlPaths.length);
    return deployment ? {
      _id: deployment._id,
      deploymentKey: deployment.deploymentKey,
      label: deployment.label,
      branch: deployment.branch,
      commitSha: deployment.commitSha,
      pageCount: deployment.htmlPaths.length,
      primaryHtmlPath: deployment.htmlPaths[0],
      createdAt: deployment.createdAt,
      completedAt: deployment.completedAt,
    } : null;
  },
});

export const browse = query({
  args: { deploymentId: v.id("mockDeployments") },
  handler: async (ctx, args) => {
    const deployment = await ctx.db.get(args.deploymentId);
    if (!deployment || !deployment.completedAt)
      throw new ConvexError("Hosted deployment not found.");
    const { membership } = await requireProject(ctx, deployment.projectId);
    const [projectPages, mockRecords] = await Promise.all([
      ctx.db.query("pages").withIndex("by_project", (q) => q.eq("projectId", deployment.projectId)).collect(),
      ctx.db.query("mockRecords").withIndex("by_project", (q) => q.eq("projectId", deployment.projectId)).collect(),
    ]);
    const recordsByPath = new Map(mockRecords.map((record) => [record.path, record]));

    const files = await Promise.all(
      deployment.manifest.filter((file) => file.contentType.split(";", 1)[0] === "text/html").map(async (file) => {
        const pages = projectPages.filter((page) => hostedPageMatchesPath(page.pageKey, file.path));
        const threads = (await Promise.all(pages.map((page) =>
          ctx.db.query("threads").withIndex("by_page", (q) => q.eq("pageId", page._id)).collect()
        ))).flat();
        const visible = threads.filter((thread) => !thread.deletedAt);
        const open = visible.filter((thread) => !thread.resolvedAt).length;
        return {
          ...file,
          status: recordsByPath.get(file.path)?.status ?? "mocking",
          pageIds: pages.map((page) => page._id),
          conversations: visible.length,
          open,
          resolved: visible.length - open,
        };
      }),
    );
    return {
      deployment: {
        _id: deployment._id,
        deploymentKey: deployment.deploymentKey,
        label: deployment.label,
        branch: deployment.branch,
        commitSha: deployment.commitSha,
        createdAt: deployment.createdAt,
        completedAt: deployment.completedAt,
      },
      projectRole: membership.role,
      files,
    };
  },
});

export const validateDeployAccess = internalQuery({
  args: { tokenHash: v.string(), projectKey: v.string() },
  handler: async (ctx, args) => {
    const { project } = await requireDeployAccess(ctx, args.tokenHash, args.projectKey);
    return { project: { key: project.projectKey, name: project.name } };
  },
});

export const resolveHostedAsset = internalQuery({
  args: { tokenHash: v.string(), deploymentKey: v.string(), path: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.query("memberPreviewSessions").withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash)).unique();
    const deployment = await ctx.db.query("mockDeployments").withIndex("by_deployment_key", (q) => q.eq("deploymentKey", args.deploymentKey)).unique();
    if (!session || !deployment || !deployment.completedAt || session.projectId !== deployment.projectId || session.revokedAt || session.expiresAt < Date.now())
      return null;
    const project = await ctx.db.get(deployment.projectId);
    if (!project || project.deletedAt) return null;
    const [projectMembership, workspaceMembership] = await Promise.all([
      ctx.db.query("projectMemberships").withIndex("by_project_user", (q) => q.eq("projectId", project._id).eq("userId", session.userId)).unique(),
      ctx.db.query("memberships").withIndex("by_org_user", (q) => q.eq("organizationId", project.organizationId).eq("userId", session.userId)).unique(),
    ]);
    if (!projectMembership || !workspaceMembership) return null;
    const asset = await ctx.db.query("mockAssets").withIndex("by_deployment_path", (q) => q.eq("deploymentId", deployment._id).eq("path", args.path)).unique();
    return asset ? { storageId: asset.storageId, contentType: asset.contentType, projectKey: project.projectKey } : null;
  },
});

async function requireDeployAccess(ctx: any, tokenHash: string, projectKey: string) {
  const [token, project] = await Promise.all([
    ctx.db.query("accessTokens").withIndex("by_token_hash", (q: any) => q.eq("tokenHash", tokenHash)).unique(),
    ctx.db.query("projects").withIndex("by_project_key", (q: any) => q.eq("projectKey", projectKey)).unique(),
  ]);
  if (!token || !project || token.projectId !== project._id || token.kind !== "deployment" || token.revokedAt || project.deletedAt || (token.expiresAt && token.expiresAt < Date.now()))
    throw new ConvexError("Deployment access is invalid or expired.");
  return { token, project };
}

async function pruneSupersededDeployments(ctx: any, projectId: any, keepDeploymentId: any) {
  const deployments = await ctx.db
    .query("mockDeployments")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  let pruned = 0;
  for (const deployment of deployments) {
    if (deployment._id === keepDeploymentId) continue;
    const assets = await ctx.db
      .query("mockAssets")
      .withIndex("by_deployment", (q: any) => q.eq("deploymentId", deployment._id))
      .collect();
    for (const asset of assets) {
      await ctx.storage.delete(asset.storageId);
      await ctx.db.delete(asset._id);
    }
    await ctx.db.delete(deployment._id);
    pruned += 1;
  }
  return pruned;
}

function validateFiles(files: Array<{ path: string; contentType: string; size: number; sha256: string }>) {
  if (!files.length || files.length > MAX_FILES) throw new ConvexError(`Deployment must contain 1-${MAX_FILES} files.`);
  const paths = new Set<string>();
  let total = 0;
  for (const file of files) {
    if (!isSafePath(file.path) || paths.has(file.path)) throw new ConvexError("Deployment contains an invalid or duplicate path.");
    if (!Number.isInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES) throw new ConvexError("Deployment file exceeds size limit.");
    if (!/^[a-f0-9]{64}$/.test(file.sha256) || file.contentType.length > 120) throw new ConvexError("Deployment file metadata is invalid.");
    paths.add(file.path);
    total += file.size;
  }
  if (total > MAX_TOTAL_BYTES) throw new ConvexError("Deployment exceeds total size limit.");
  if (!files.some((file) => file.contentType === "text/html")) throw new ConvexError("Deployment must contain at least one HTML file.");
}

function isSafePath(path: string) {
  return path.length > 0 && path.length <= 500 && !path.startsWith("/") && !path.includes("\\") && !path.split("/").some((part) => !part || part === "." || part === "..");
}

export function matchesStorageMetadata(
  stored: { size: number; sha256: string } | null,
  expected: { size: number; sha256: string },
) {
  return Boolean(
    stored &&
      stored.size === expected.size &&
      stored.sha256.toLowerCase() === expected.sha256.toLowerCase(),
  );
}
