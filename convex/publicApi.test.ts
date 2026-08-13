/// <reference types="vite/client" />
import { createHash } from "node:crypto";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.js", "./**/*.ts", "!./**/*.d.ts"]);
const cliToken = `mmi_${"d".repeat(64)}`;
const cliTokenHash = createHash("sha256").update(cliToken).digest("hex");

async function seed(t: ReturnType<typeof convexTest>, suffix = "a", addToken = true) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      name: `Owner ${suffix}`,
      email: `owner-${suffix}@example.com`,
    });
    const organizationId = await ctx.db.insert("organizations", {
      name: `Team ${suffix}`,
      slug: `team-${suffix}`,
      createdBy: userId,
      createdAt: 1,
    });
    const projectKey = `mmp_${suffix.repeat(36)}`;
    const projectId = await ctx.db.insert("projects", {
      organizationId,
      name: `Web ${suffix}`,
      slug: `web-${suffix}`,
      projectKey,
      createdBy: userId,
      createdAt: 1,
    });
    let tokenId;
    if (addToken)
      tokenId = await ctx.db.insert("accessTokens", {
        projectId,
        kind: "installation",
        label: "Private CLI",
        tokenHash: cliTokenHash,
        tokenPrefix: cliToken.slice(0, 12),
        createdBy: userId,
        createdAt: 1,
      });
    const pageId = await ctx.db.insert("pages", {
      projectId,
      pageKey: `preview.example/${suffix}`,
      path: `/${suffix}`,
      title: "Mock",
      lastSeenAt: 1,
    });
    const threadId = await ctx.db.insert("threads", {
      projectId,
      pageId,
      x: 0.2,
      y: 0.3,
      viewportWidth: 1200,
      viewportHeight: 800,
      authorName: "Member",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("messages", {
      projectId,
      threadId,
      authorName: "Member",
      body: "Move this heading down.",
      createdAt: 1,
    });
    return { projectId, projectKey, tokenId };
  });
}

describe("private CLI feedback API", () => {
  test("reads only feedback for its project", async () => {
    const t = convexTest(schema, modules);
    const { projectKey } = await seed(t);
    const result: any = await t.action(api.publicApi.read, {
      token: cliToken,
      projectKey,
      unresolvedOnly: true,
    });
    expect(result.project.key).toBe(projectKey);
    expect(result.threads[0].messages[0].body).toBe("Move this heading down.");
  });

  test("rejects cross-project use", async () => {
    const t = convexTest(schema, modules);
    await seed(t);
    const other = await seed(t, "b", false);
    await expect(
      t.action(api.publicApi.read, { token: cliToken, projectKey: other.projectKey }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  test("cannot open or write to member mocks", async () => {
    const t = convexTest(schema, modules);
    const { projectKey } = await seed(t);
    await expect(
      t.action(api.publicApi.readMock, { token: cliToken, projectKey }),
    ).rejects.toThrow(/invalid or expired/i);
    await expect(
      t.action(api.publicApi.createThread, {
        token: cliToken,
        projectKey,
        pageKey: "preview.example/new",
        path: "/new",
        title: "Mock",
        x: 0.1,
        y: 0.1,
        viewportWidth: 800,
        viewportHeight: 600,
        body: "Forbidden write.",
      }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  test("rejects revoked and expired credentials", async () => {
    const t = convexTest(schema, modules);
    const { projectKey, tokenId } = await seed(t);
    await t.run((ctx) => ctx.db.patch(tokenId!, { revokedAt: Date.now() }));
    await expect(
      t.action(api.publicApi.read, { token: cliToken, projectKey }),
    ).rejects.toThrow(/invalid or expired/i);
    await t.run((ctx) =>
      ctx.db.patch(tokenId!, { revokedAt: undefined, expiresAt: Date.now() - 1 }),
    );
    await expect(
      t.action(api.publicApi.read, { token: cliToken, projectKey }),
    ).rejects.toThrow(/invalid or expired/i);
  });
});
