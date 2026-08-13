/// <reference types="vite/client" />
import { createHash } from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.js", "./**/*.ts", "!./**/*.d.ts"]);
const reviewToken = `mmr_${"a".repeat(64)}`;
const installationToken = `mmi_${"d".repeat(64)}`;
const reviewTokenHash = createHash("sha256").update(reviewToken).digest("hex");
const installationTokenHash = createHash("sha256")
  .update(installationToken)
  .digest("hex");

async function seed(
  t: ReturnType<typeof convexTest>,
  projectKey = `mmp_${"b".repeat(36)}`,
  addToken = true,
) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: "Owner",
      email: "owner@example.com",
    });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Team",
      slug: "team",
      createdBy: userId,
      createdAt: 1,
    });
    const projectId = await ctx.db.insert("projects", {
      organizationId,
      name: "Web",
      slug: "web",
      projectKey,
      createdBy: userId,
      createdAt: 1,
    });
    let reviewTokenId;
    if (addToken) {
      reviewTokenId = await ctx.db.insert("accessTokens", {
        projectId,
        kind: "review",
        label: "Review",
        tokenHash: reviewTokenHash,
        tokenPrefix: reviewToken.slice(0, 12),
        createdBy: userId,
        createdAt: 1,
      });
      await ctx.db.insert("accessTokens", {
        projectId,
        kind: "installation",
        label: "CLI",
        tokenHash: installationTokenHash,
        tokenPrefix: installationToken.slice(0, 12),
        createdBy: userId,
        createdAt: 1,
      });
    }
    return { organizationId, projectId, projectKey, reviewTokenId };
  });
}

describe("public review API", () => {
  test("creates and reads a tenant-scoped conversation", async () => {
    const t = convexTest(schema, modules);
    const { projectKey } = await seed(t);
    const threadId = await t.action(api.publicApi.createThread, {
      token: reviewToken,
      projectKey,
      pageKey: "localhost/mock.html",
      path: "/mock.html",
      title: "Mock",
      x: 0.2,
      y: 0.3,
      viewportWidth: 1200,
      viewportHeight: 800,
      authorName: "Ada Lovelace",
      authorEmail: "ada@example.com",
      body: "Move this heading down.",
    });
    await t.action(api.publicApi.reply, {
      token: reviewToken,
      projectKey,
      threadId: threadId as any,
      authorName: "Grace Hopper",
      body: "Agreed.",
    });
    const result: any = await t.action(api.publicApi.readReview, {
      token: reviewToken,
      projectKey,
      unresolvedOnly: true,
    });
    expect(result.threads).toHaveLength(1);
    expect(
      result.threads[0].messages.map((message: any) => message.body),
    ).toEqual(["Move this heading down.", "Agreed."]);
  });

  test("rejects cross-project token use", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    const other = await seed(t, `mmp_${"c".repeat(36)}`, false);
    await expect(
      t.action(api.publicApi.readReview, {
        token: reviewToken,
        projectKey: other.projectKey,
      }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  test("resolves and filters conversations", async () => {
    const t = convexTest(schema, modules);
    const { projectKey } = await seed(t);
    const threadId: any = await t.action(api.publicApi.createThread, {
      token: reviewToken,
      projectKey,
      pageKey: "localhost/mock.html",
      path: "/mock.html",
      title: "Mock",
      x: 0.1,
      y: 0.1,
      viewportWidth: 800,
      viewportHeight: 600,
      authorName: "Reviewer",
      body: "Check spacing.",
    });
    await t.action(api.publicApi.setResolved, {
      token: reviewToken,
      projectKey,
      threadId,
      authorName: "Reviewer",
      resolved: true,
    });
    const open: any = await t.action(api.publicApi.readReview, {
      token: reviewToken,
      projectKey,
      unresolvedOnly: true,
    });
    const all: any = await t.action(api.publicApi.readReview, {
      token: reviewToken,
      projectKey,
      unresolvedOnly: false,
    });
    expect(open.threads).toHaveLength(0);
    expect(all.threads[0].resolvedAt).toBeTypeOf("number");
  });

  test("keeps review and installation token scopes separate", async () => {
    const t = convexTest(schema, modules);
    const { projectKey } = await seed(t);

    await expect(
      t.action(api.publicApi.createThread, {
        token: installationToken,
        projectKey,
        pageKey: "localhost/mock.html",
        path: "/mock.html",
        title: "Mock",
        x: 0.1,
        y: 0.1,
        viewportWidth: 800,
        viewportHeight: 600,
        authorName: "Reviewer",
        body: "This must not be accepted.",
      }),
    ).rejects.toThrow(/invalid or expired/i);
    await expect(
      t.action(api.publicApi.read, { token: reviewToken, projectKey }),
    ).rejects.toThrow(/invalid or expired/i);
    await expect(
      t.action(api.publicApi.readReview, {
        token: installationToken,
        projectKey,
      }),
    ).rejects.toThrow(/invalid or expired/i);

    const cliResult: any = await t.action(api.publicApi.read, {
      token: installationToken,
      projectKey,
    });
    expect(cliResult.project.key).toBe(projectKey);
  });

  test("rate limits public writes per token", async () => {
    const t = convexTest(schema, modules);
    const { projectKey, reviewTokenId } = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("rateLimits", {
        key: `${reviewTokenId}:create`,
        windowStart: Date.now(),
        count: 30,
        updatedAt: Date.now(),
      });
    });

    await expect(
      t.action(api.publicApi.createThread, {
        token: reviewToken,
        projectKey,
        pageKey: "localhost/mock.html",
        path: "/mock.html",
        title: "Mock",
        x: 0.1,
        y: 0.1,
        viewportWidth: 800,
        viewportHeight: 600,
        authorName: "Reviewer",
        body: "This exceeds the write limit.",
      }),
    ).rejects.toThrow(/too many requests/i);
  });

  test("deduplicates retried thread and reply writes", async () => {
    const t = convexTest(schema, modules);
    const { projectKey } = await seed(t);
    const createArgs = {
      token: reviewToken,
      projectKey,
      pageKey: "localhost/mock.html",
      path: "/mock.html",
      title: "Mock",
      x: 0.25,
      y: 0.25,
      viewportWidth: 800,
      viewportHeight: 600,
      authorName: "Reviewer",
      body: "Only create this once.",
      requestId: "request-thread-0001",
    };
    const firstThread: any = await t.action(
      api.publicApi.createThread,
      createArgs,
    );
    const retriedThread: any = await t.action(
      api.publicApi.createThread,
      createArgs,
    );
    expect(retriedThread).toBe(firstThread);

    const replyArgs = {
      token: reviewToken,
      projectKey,
      threadId: firstThread,
      authorName: "Reviewer",
      body: "Only reply once.",
      requestId: "request-reply-0001",
    };
    const firstReply = await t.action(api.publicApi.reply, replyArgs);
    const retriedReply = await t.action(api.publicApi.reply, replyArgs);
    expect(retriedReply).toBe(firstReply);

    const result: any = await t.action(api.publicApi.readReview, {
      token: reviewToken,
      projectKey,
    });
    expect(result.threads).toHaveLength(1);
    expect(result.threads[0].messages).toHaveLength(2);
  });
});
