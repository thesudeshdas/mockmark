import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { audit, requireProject } from "./lib/authz";
import { hashToken } from "./lib/tokens";
import { consumeRateLimit } from "./lib/rateLimit";
import { hostedPageMatchesPath } from "./lib/hostedRuntime";
import {
  markMockInReview,
  mockPathFromPageKey,
  restoreReadyWhenReviewEmpty,
} from "./mockLifecycle";
import {
  ALLOWED_REACTIONS,
  cleanBody,
  cleanText,
  validateRegion,
} from "./lib/validation";

export const feedbackForDashboard = query({
  args: {
    projectId: v.id("projects"),
    pageId: v.optional(v.id("pages")),
    pageIds: v.optional(v.array(v.id("pages"))),
    unresolvedOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireProject(ctx, args.projectId);
    return hydrateProject(
      ctx,
      args.projectId,
      args.pageIds ?? (args.pageId ? [args.pageId] : undefined),
      args.unresolvedOnly ?? false,
    );
  },
});

export const deleteThreadForDashboard = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.deletedAt) throw new ConvexError("Thread not found.");
    const { project, userId, user } = await requireProject(
      ctx,
      thread.projectId,
      "admin",
    );
    await ctx.db.patch(thread._id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
    const page = await ctx.db.get(thread.pageId);
    const mockPath = page ? mockPathFromPageKey(page.pageKey) : null;
    if (mockPath)
      await restoreReadyWhenReviewEmpty(ctx, {
        project,
        path: mockPath,
        actorUserId: userId,
        actorName: user.name,
      });
    await audit(ctx, {
      organizationId: project.organizationId,
      projectId: project._id,
      actorUserId: userId,
      action: "thread.deleted",
      targetType: "thread",
      targetId: thread._id,
    });
  },
});

export const read = action({
  args: {
    token: v.string(),
    projectKey: v.string(),
    pageKey: v.optional(v.string()),
    unresolvedOnly: v.optional(v.boolean()),
    updatedSince: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const tokenHash = await hashToken(args.token);
    return exposePublicErrors(() =>
      ctx.runMutation(internal.publicApi.readWithToken, {
        ...args,
        tokenHash,
        requiredKind: "installation",
      }),
    );
  },
});

export const readMock = action({
  args: {
    token: v.string(),
    projectKey: v.string(),
    pageKey: v.optional(v.string()),
    unresolvedOnly: v.optional(v.boolean()),
    updatedSince: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<unknown> => {
    const tokenHash = await hashToken(args.token);
    return exposePublicErrors(() =>
      ctx.runMutation(internal.publicApi.readWithToken, {
        ...args,
        tokenHash,
        requiredKind: "member",
      }),
    );
  },
});

export const readWithToken = internalMutation({
  args: {
    token: v.string(),
    tokenHash: v.string(),
    projectKey: v.string(),
    pageKey: v.optional(v.string()),
    unresolvedOnly: v.optional(v.boolean()),
    updatedSince: v.optional(v.number()),
    requiredKind: v.union(v.literal("installation"), v.literal("member")),
  },
  handler: async (ctx, args) => {
    const access =
      args.requiredKind === "installation"
        ? await requireCliAccess(ctx, args.tokenHash, args.projectKey)
        : await requireMemberAccess(ctx, args.tokenHash, args.projectKey, "viewer");
    await consumeRateLimit(
      ctx,
      `${access.rateKey}:read`,
      240,
    );
    const pageIds = args.pageKey
      ? (await ctx.db
          .query("pages")
          .withIndex("by_project", (q) => q.eq("projectId", access.project._id))
          .collect())
          .filter((page) => args.pageKey!.startsWith("hosted:")
            ? hostedPageMatchesPath(page.pageKey, args.pageKey!.slice("hosted:".length))
            : page.pageKey === args.pageKey)
          .map((page) => page._id)
      : undefined;
    const feedback = await hydrateProject(
      ctx,
      access.project._id,
      pageIds,
      args.unresolvedOnly ?? false,
      args.updatedSince,
    );
    return {
      project: {
        id: access.project._id,
        key: access.project.projectKey,
        name: access.project.name,
      },
      ...feedback,
    };
  },
});

export const createThread = action({
  args: {
    token: v.string(),
    projectKey: v.string(),
    pageKey: v.string(),
    path: v.string(),
    title: v.string(),
    buildKey: v.optional(v.string()),
    branch: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    x: v.number(),
    y: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    selector: v.optional(v.string()),
    nearbyText: v.optional(v.string()),
    viewportWidth: v.number(),
    viewportHeight: v.number(),
    requestId: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const tokenHash = await hashToken(args.token);
    return exposePublicErrors(() =>
      ctx.runMutation(internal.publicApi.createThreadWithToken, {
        ...args,
        tokenHash,
      }),
    );
  },
});

export const createThreadWithToken = internalMutation({
  args: {
    token: v.string(),
    tokenHash: v.string(),
    projectKey: v.string(),
    pageKey: v.string(),
    path: v.string(),
    title: v.string(),
    buildKey: v.optional(v.string()),
    branch: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    x: v.number(),
    y: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    selector: v.optional(v.string()),
    nearbyText: v.optional(v.string()),
    viewportWidth: v.number(),
    viewportHeight: v.number(),
    requestId: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireMemberAccess(
      ctx,
      args.tokenHash,
      args.projectKey,
      "commenter",
    );
    const prior = await idempotentResult(
      ctx,
      access,
      "thread.create",
      args.requestId,
    );
    if (prior) return prior;
    await consumeRateLimit(ctx, `${access.rateKey}:create`, 30);
    validateRegion(args);
    const authorName = cleanText(access.user.name ?? "Member", "Author name", 2, 80);
    const authorEmail = access.user.email;
    const body = cleanBody(args.body);
    const now = Date.now();
    let page = await ctx.db
      .query("pages")
      .withIndex("by_project_key", (q) =>
        q.eq("projectId", access.project._id).eq("pageKey", args.pageKey),
      )
      .unique();
    if (page)
      await ctx.db.patch(page._id, {
        path: args.path.slice(0, 500),
        title: args.title.slice(0, 200),
        lastSeenAt: now,
      });
    else {
      const pageId = await ctx.db.insert("pages", {
        projectId: access.project._id,
        pageKey: args.pageKey.slice(0, 240),
        path: args.path.slice(0, 500),
        title: args.title.slice(0, 200),
        lastSeenAt: now,
      });
      page = (await ctx.db.get(pageId))!;
    }
    let buildId;
    if (args.buildKey) {
      const existing = await ctx.db
        .query("builds")
        .withIndex("by_project_key", (q) =>
          q.eq("projectId", access.project._id).eq("buildKey", args.buildKey!),
        )
        .unique();
      buildId =
        existing?._id ??
        (await ctx.db.insert("builds", {
          projectId: access.project._id,
          buildKey: args.buildKey.slice(0, 120),
          branch: args.branch?.slice(0, 200),
          commitSha: args.commitSha?.slice(0, 80),
          createdAt: now,
        }));
    }
    const threadId = await ctx.db.insert("threads", {
      projectId: access.project._id,
      pageId: page._id,
      buildId,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      selector: args.selector?.slice(0, 1000),
      nearbyText: args.nearbyText?.slice(0, 500),
      viewportWidth: Math.max(1, Math.round(args.viewportWidth)),
      viewportHeight: Math.max(1, Math.round(args.viewportHeight)),
      authorName,
      authorEmail,
      createdAt: now,
      updatedAt: now,
    });
    const messageId = await ctx.db.insert("messages", {
      projectId: access.project._id,
      threadId,
      authorName,
      authorEmail,
      body,
      createdAt: now,
    });
    const mockPath = mockPathFromPageKey(page.pageKey);
    if (mockPath)
      await markMockInReview(ctx, {
        project: access.project,
        path: mockPath,
        actorUserId: access.user._id,
        actorName: access.user.name,
      });
    await addMentions(
      ctx,
      access.project.organizationId,
      access.project._id,
      messageId,
      body,
    );
    await audit(ctx, {
      organizationId: access.project.organizationId,
      projectId: access.project._id,
      actorUserId: access.user?._id,
      action: "thread.created",
      targetType: "thread",
      targetId: threadId,
    });
    await rememberIdempotentResult(
      ctx,
      access,
      "thread.create",
      args.requestId,
      threadId,
    );
    return threadId;
  },
});

export const reply = action({
  args: {
    token: v.string(),
    projectKey: v.string(),
    threadId: v.id("threads"),
    requestId: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const tokenHash = await hashToken(args.token);
    return exposePublicErrors(() =>
      ctx.runMutation(internal.publicApi.replyWithToken, {
        ...args,
        tokenHash,
      }),
    );
  },
});

export const replyWithToken = internalMutation({
  args: {
    token: v.string(),
    tokenHash: v.string(),
    projectKey: v.string(),
    threadId: v.id("threads"),
    requestId: v.optional(v.string()),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireMemberAccess(
      ctx,
      args.tokenHash,
      args.projectKey,
      "commenter",
    );
    const prior = await idempotentResult(
      ctx,
      access,
      "message.reply",
      args.requestId,
    );
    if (prior) return prior;
    await consumeRateLimit(ctx, `${access.rateKey}:reply`, 60);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.projectId !== access.project._id || thread.deletedAt)
      throw new ConvexError("Thread not found.");
    if (thread.resolvedAt) throw new ConvexError("Thread is resolved.");
    const authorName = cleanText(access.user.name ?? "Member", "Author name", 2, 80);
    const authorEmail = access.user.email;
    const body = cleanBody(args.body);
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      projectId: access.project._id,
      threadId: thread._id,
      authorName,
      authorEmail,
      body,
      createdAt: now,
    });
    await ctx.db.patch(thread._id, { updatedAt: now });
    await addMentions(
      ctx,
      access.project.organizationId,
      access.project._id,
      messageId,
      body,
    );
    await audit(ctx, {
      organizationId: access.project.organizationId,
      projectId: access.project._id,
      actorUserId: access.user?._id,
      action: "message.created",
      targetType: "message",
      targetId: messageId,
    });
    await rememberIdempotentResult(
      ctx,
      access,
      "message.reply",
      args.requestId,
      messageId,
    );
    return messageId;
  },
});

export const setResolved = action({
  args: {
    token: v.string(),
    projectKey: v.string(),
    threadId: v.id("threads"),
    resolved: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const tokenHash = await hashToken(args.token);
    await exposePublicErrors(() =>
      ctx.runMutation(internal.publicApi.setResolvedWithToken, {
        ...args,
        tokenHash,
      }),
    );
  },
});

export const setResolvedWithToken = internalMutation({
  args: {
    token: v.string(),
    tokenHash: v.string(),
    projectKey: v.string(),
    threadId: v.id("threads"),
    resolved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const access = await requireMemberAccess(
      ctx,
      args.tokenHash,
      args.projectKey,
      "commenter",
    );
    await consumeRateLimit(ctx, `${access.rateKey}:resolve`, 120);
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.projectId !== access.project._id || thread.deletedAt)
      throw new ConvexError("Thread not found.");
    const authorName = cleanText(access.user.name ?? "Member", "Author name", 2, 80);
    const now = Date.now();
    await ctx.db.patch(
      thread._id,
      args.resolved
        ? { resolvedAt: now, resolvedByName: authorName, updatedAt: now }
        : { resolvedAt: undefined, resolvedByName: undefined, updatedAt: now },
    );
    await audit(ctx, {
      organizationId: access.project.organizationId,
      projectId: access.project._id,
      actorUserId: access.user?._id,
      action: args.resolved ? "thread.resolved" : "thread.reopened",
      targetType: "thread",
      targetId: thread._id,
    });
  },
});

export const toggleReaction = action({
  args: {
    token: v.string(),
    projectKey: v.string(),
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const tokenHash = await hashToken(args.token);
    return exposePublicErrors(() =>
      ctx.runMutation(internal.publicApi.toggleReactionWithToken, {
        ...args,
        tokenHash,
      }),
    );
  },
});

export const toggleReactionWithToken = internalMutation({
  args: {
    token: v.string(),
    tokenHash: v.string(),
    projectKey: v.string(),
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const access = await requireMemberAccess(
      ctx,
      args.tokenHash,
      args.projectKey,
      "commenter",
    );
    await consumeRateLimit(ctx, `${access.rateKey}:reaction`, 240);
    const message = await ctx.db.get(args.messageId);
    if (
      !message ||
      message.projectId !== access.project._id ||
      message.deletedAt
    )
      throw new ConvexError("Message not found.");
    if (!ALLOWED_REACTIONS.has(args.emoji))
      throw new ConvexError("Unsupported reaction.");
    const authorName = cleanText(access.user.name ?? "Member", "Author name", 2, 80);
    const authorKey = access.user.email ?? String(access.user._id);
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message_author_emoji", (q) =>
        q
          .eq("messageId", message._id)
          .eq("authorKey", authorKey)
          .eq("emoji", args.emoji),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("reactions", {
      projectId: access.project._id,
      messageId: message._id,
      emoji: args.emoji,
      authorKey,
      authorName,
      createdAt: Date.now(),
    });
    return true;
  },
});

async function requireCliAccess(
  ctx: any,
  tokenHash: string,
  projectKey: string,
) {
  const [token, project] = await Promise.all([
    ctx.db
      .query("accessTokens")
      .withIndex("by_token_hash", (q: any) => q.eq("tokenHash", tokenHash))
      .unique(),
    ctx.db
      .query("projects")
      .withIndex("by_project_key", (q: any) => q.eq("projectKey", projectKey))
      .unique(),
  ]);
  if (
    !token ||
    !project ||
    token.projectId !== project._id ||
    token.kind !== "installation" ||
    token.revokedAt ||
    project.deletedAt ||
    (token.expiresAt && token.expiresAt < Date.now())
  )
    throw new ConvexError("CLI access is invalid or expired.");
  return { token, project, rateKey: String(token._id) };
}

type MemberAccess = {
  session: any;
  project: any;
  user: any;
  rateKey: string;
};

async function requireMemberAccess(
  ctx: any,
  tokenHash: string,
  projectKey: string,
  minimum: "viewer" | "commenter",
): Promise<MemberAccess> {
  const project = await ctx.db
    .query("projects")
    .withIndex("by_project_key", (q: any) => q.eq("projectKey", projectKey))
    .unique();
  if (!project || project.deletedAt)
    throw new ConvexError("Mock access is invalid or expired.");

  const session = await ctx.db
    .query("memberPreviewSessions")
    .withIndex("by_token_hash", (q: any) => q.eq("tokenHash", tokenHash))
    .unique();
  if (
    !session ||
    session.projectId !== project._id ||
    session.revokedAt ||
    session.expiresAt < Date.now()
  )
    throw new ConvexError("Mock access is invalid or expired.");
  const [projectMembership, workspaceMembership, user] = await Promise.all([
    ctx.db
      .query("projectMemberships")
      .withIndex("by_project_user", (q: any) =>
        q.eq("projectId", project._id).eq("userId", session.userId),
      )
      .unique(),
    ctx.db
      .query("memberships")
      .withIndex("by_org_user", (q: any) =>
        q.eq("organizationId", project.organizationId).eq("userId", session.userId),
      )
      .unique(),
    ctx.db.get(session.userId),
  ]);
  const roleRank = { viewer: 0, commenter: 1, admin: 2 } as const;
  if (
    !projectMembership ||
    !workspaceMembership ||
    !user ||
    roleRank[projectMembership.role as keyof typeof roleRank] < roleRank[minimum]
  )
    throw new ConvexError("Mock access is invalid or expired.");
  return {
    session,
    project,
    user,
    rateKey: String(session._id),
  };
}

type IdempotentOperation = "thread.create" | "message.reply";

async function idempotentResult(
  ctx: any,
  access: MemberAccess,
  operation: IdempotentOperation,
  requestId?: string,
) {
  if (!requestId) return null;
  validateRequestId(requestId);
  return (
    await ctx.db
      .query("idempotencyKeys")
      .withIndex("by_preview_operation_request", (q: any) =>
        q
          .eq("previewSessionId", access.session._id)
          .eq("operation", operation)
          .eq("requestId", requestId),
      )
      .unique()
  )?.resultId;
}

async function rememberIdempotentResult(
  ctx: any,
  access: MemberAccess,
  operation: IdempotentOperation,
  requestId: string | undefined,
  resultId: string,
) {
  if (!requestId) return;
  await ctx.db.insert("idempotencyKeys", {
    previewSessionId: access.session._id,
    operation,
    requestId,
    resultId,
    createdAt: Date.now(),
  });
}

function validateRequestId(requestId: string) {
  if (!/^[A-Za-z0-9._:-]{16,128}$/.test(requestId))
    throw new ConvexError("Invalid request identifier.");
}

const safePublicErrors = [
  /^(Mock|CLI) access is invalid or expired\.$/,
  /^Too many requests\. Try again shortly\.$/,
  /^(Thread|Message) not found\.$/,
  /^Thread is resolved\.$/,
  /^(Author name|Comment) must be /,
  /^(Position|Region size) must be /,
  /^Region width and height must be paired\.$/,
  /^Unsupported reaction\.$/,
  /^Invalid request identifier\.$/,
];

async function exposePublicErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const raw =
      typeof (error as { data?: unknown })?.data === "string"
        ? String((error as { data: string }).data)
        : error instanceof Error
          ? error.message
          : "";
    const matches = [...raw.matchAll(/ConvexError:\s*([^\n]+)/g)];
    const nested = matches[matches.length - 1]?.[1];
    const message = (nested ?? raw).trim();
    throw new ConvexError(
      safePublicErrors.some((pattern) => pattern.test(message))
        ? message
        : "Request could not be completed.",
    );
  }
}

async function hydrateProject(
  ctx: any,
  projectId: any,
  pageIds?: any[],
  unresolvedOnly = false,
  updatedSince?: number,
) {
  const threads = pageIds
    ? (await Promise.all(pageIds.map((pageId) =>
        ctx.db
          .query("threads")
          .withIndex("by_page", (q: any) => q.eq("pageId", pageId))
          .collect()
      ))).flat()
    : await ctx.db
        .query("threads")
        .withIndex("by_project_updated", (q: any) =>
          q.eq("projectId", projectId),
        )
        .order("desc")
        .take(500);
  const selected = threads.filter(
    (thread: any) =>
      !thread.deletedAt &&
      (!unresolvedOnly || !thread.resolvedAt) &&
      (!updatedSince || thread.updatedAt >= updatedSince),
  );
  const hydrated = await Promise.all(
    selected.map(async (thread: any) => {
      const [page, build, messages] = await Promise.all([
        ctx.db.get(thread.pageId),
        thread.buildId ? ctx.db.get(thread.buildId) : null,
        ctx.db
          .query("messages")
          .withIndex("by_thread", (q: any) => q.eq("threadId", thread._id))
          .collect(),
      ]);
      const visibleMessages = messages.filter(
        (message: any) => !message.deletedAt,
      );
      const reactions = (
        await Promise.all(
          visibleMessages.map((message: any) =>
            ctx.db
              .query("reactions")
              .withIndex("by_message", (q: any) =>
                q.eq("messageId", message._id),
              )
              .collect(),
          ),
        )
      ).flat();
      return {
        ...thread,
        page,
        build,
        messages: visibleMessages.map((message: any) => ({
          ...message,
          reactions: reactions.filter(
            (reaction: any) => reaction.messageId === message._id,
          ),
        })),
      };
    }),
  );
  return {
    threads: hydrated.sort((a: any, b: any) => b.updatedAt - a.updatedAt),
    fetchedAt: Date.now(),
  };
}

async function addMentions(
  ctx: any,
  organizationId: any,
  projectId: any,
  messageId: any,
  body: string,
) {
  const handles = [...body.matchAll(/@([\w.-]{2,80})/g)].map((match) =>
    match[1].toLowerCase(),
  );
  if (!handles.length) return;
  const memberships = await ctx.db
    .query("projectMemberships")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();
  for (const membership of memberships) {
    const user = await ctx.db.get(membership.userId);
    const candidates = [
      user?.name?.toLowerCase().replace(/\s+/g, ""),
      user?.email?.split("@")[0]?.toLowerCase(),
    ];
    if (handles.some((handle) => candidates.includes(handle)))
      await ctx.db.insert("mentions", {
        projectId,
        messageId,
        mentionedUserId: membership.userId,
        createdAt: Date.now(),
      });
  }
}
