import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("commenter"),
  v.literal("viewer"),
);

export default defineSchema({
  ...authTables,
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_slug", ["slug"]),
  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role,
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["organizationId", "userId"]),
  invitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    role,
    tokenHash: v.string(),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_org", ["organizationId"]),
  projects: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    projectKey: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  })
    .index("by_org", ["organizationId"])
    .index("by_project_key", ["projectKey"])
    .index("by_org_slug", ["organizationId", "slug"]),
  projectMemberships: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("commenter"),
      v.literal("viewer"),
    ),
    addedBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"]),
  projectInvitations: defineTable({
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("commenter"),
      v.literal("viewer"),
    ),
    tokenHash: v.string(),
    invitedBy: v.id("users"),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_project", ["projectId"]),
  projectOrigins: defineTable({
    projectId: v.id("projects"),
    origin: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_origin", ["projectId", "origin"]),
  accessTokens: defineTable({
    projectId: v.id("projects"),
    kind: v.union(v.literal("installation"), v.literal("review")),
    label: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_project", ["projectId"]),
  memberPreviewSessions: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"]),
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  idempotencyKeys: defineTable({
    tokenId: v.optional(v.id("accessTokens")),
    previewSessionId: v.optional(v.id("memberPreviewSessions")),
    operation: v.union(v.literal("thread.create"), v.literal("message.reply")),
    requestId: v.string(),
    resultId: v.string(),
    createdAt: v.number(),
  }).index("by_token_operation_request", [
    "tokenId",
    "operation",
    "requestId",
  ]).index("by_preview_operation_request", [
    "previewSessionId",
    "operation",
    "requestId",
  ]),
  builds: defineTable({
    projectId: v.id("projects"),
    buildKey: v.string(),
    branch: v.optional(v.string()),
    commitSha: v.optional(v.string()),
    label: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_key", ["projectId", "buildKey"]),
  pages: defineTable({
    projectId: v.id("projects"),
    pageKey: v.string(),
    path: v.string(),
    title: v.string(),
    lastSeenAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_key", ["projectId", "pageKey"]),
  threads: defineTable({
    projectId: v.id("projects"),
    pageId: v.id("pages"),
    buildId: v.optional(v.id("builds")),
    x: v.number(),
    y: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    selector: v.optional(v.string()),
    nearbyText: v.optional(v.string()),
    viewportWidth: v.number(),
    viewportHeight: v.number(),
    authorId: v.optional(v.id("users")),
    authorName: v.string(),
    authorEmail: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    resolvedByName: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_page", ["pageId"])
    .index("by_project", ["projectId"])
    .index("by_project_updated", ["projectId", "updatedAt"]),
  messages: defineTable({
    projectId: v.id("projects"),
    threadId: v.id("threads"),
    authorId: v.optional(v.id("users")),
    authorName: v.string(),
    authorEmail: v.optional(v.string()),
    body: v.string(),
    createdAt: v.number(),
    editedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index("by_thread", ["threadId"])
    .index("by_project", ["projectId"]),
  reactions: defineTable({
    projectId: v.id("projects"),
    messageId: v.id("messages"),
    emoji: v.string(),
    authorKey: v.string(),
    authorName: v.string(),
    createdAt: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_message_author_emoji", ["messageId", "authorKey", "emoji"]),
  mentions: defineTable({
    projectId: v.id("projects"),
    messageId: v.id("messages"),
    mentionedUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["mentionedUserId"])
    .index("by_message", ["messageId"]),
  auditEvents: defineTable({
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    actorUserId: v.optional(v.id("users")),
    actorName: v.optional(v.string()),
    action: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_org", ["organizationId"])
    .index("by_project", ["projectId"]),
});
