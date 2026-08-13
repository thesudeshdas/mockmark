/// <reference types="vite/client" />
import { createHash } from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.js", "./**/*.ts", "!./**/*.d.ts"]);
const token = `mmr_${"a".repeat(64)}`;
const tokenHash = createHash("sha256").update(token).digest("hex");

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
    if (addToken)
      await ctx.db.insert("accessTokens", {
        projectId,
        kind: "review",
        label: "Review",
        tokenHash,
        tokenPrefix: token.slice(0, 12),
        createdBy: userId,
        createdAt: 1,
      });
    return { organizationId, projectId, projectKey };
  });
}

describe("public review API", () => {
  test("creates and reads a tenant-scoped conversation", async () => {
    const t = convexTest(schema, modules);
    const { projectKey } = await seed(t);
    const threadId = await t.action(api.publicApi.createThread, {
      token,
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
      token,
      projectKey,
      threadId: threadId as any,
      authorName: "Grace Hopper",
      body: "Agreed.",
    });
    const result: any = await t.action(api.publicApi.read, {
      token,
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
      t.action(api.publicApi.read, { token, projectKey: other.projectKey }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  test("resolves and filters conversations", async () => {
    const t = convexTest(schema, modules);
    const { projectKey } = await seed(t);
    const threadId: any = await t.action(api.publicApi.createThread, {
      token,
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
      token,
      projectKey,
      threadId,
      authorName: "Reviewer",
      resolved: true,
    });
    const open: any = await t.action(api.publicApi.read, {
      token,
      projectKey,
      unresolvedOnly: true,
    });
    const all: any = await t.action(api.publicApi.read, {
      token,
      projectKey,
      unresolvedOnly: false,
    });
    expect(open.threads).toHaveLength(0);
    expect(all.threads[0].resolvedAt).toBeTypeOf("number");
  });
});
