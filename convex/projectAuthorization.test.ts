/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.js", "./**/*.ts", "!./**/*.d.ts"]);

async function seedWorkspaceWithPrivateProjects(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { name: "Owner", email: "owner@example.com" });
    const bossId = await ctx.db.insert("users", { name: "Boss", email: "boss@example.com" });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Workspace W",
      slug: "workspace-w",
      createdBy: ownerId,
      createdAt: 1,
    });
    for (const [userId, role] of [[ownerId, "owner"], [bossId, "admin"]] as const)
      await ctx.db.insert("memberships", { organizationId, userId, role, createdAt: 1 });
    const workProjectId = await ctx.db.insert("projects", {
      organizationId,
      name: "Work Project",
      slug: "work-project",
      projectKey: `mmp_${"a".repeat(36)}`,
      createdBy: ownerId,
      createdAt: 1,
    });
    const personalProjectId = await ctx.db.insert("projects", {
      organizationId,
      name: "Personal Project",
      slug: "personal-project",
      projectKey: `mmp_${"b".repeat(36)}`,
      createdBy: ownerId,
      createdAt: 1,
    });
    for (const projectId of [workProjectId, personalProjectId])
      await ctx.db.insert("projectMemberships", {
        projectId,
        userId: ownerId,
        role: "admin",
        addedBy: ownerId,
        createdAt: 1,
      });
    return { ownerId, bossId, organizationId, workProjectId, personalProjectId };
  });
}

describe("project authorization", () => {
  test("workspace membership does not reveal projects", async () => {
    const t = convexTest(schema, modules);
    const { bossId, organizationId } = await seedWorkspaceWithPrivateProjects(t);
    const boss = t.withIdentity({ subject: bossId });

    await expect(boss.query(api.projects.list, { organizationId })).resolves.toEqual([]);
  });

  test("assigned user sees only assigned project and cannot open a sibling", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, bossId, organizationId, workProjectId, personalProjectId } =
      await seedWorkspaceWithPrivateProjects(t);
    await t.run((ctx) =>
      ctx.db.insert("projectMemberships", {
        projectId: workProjectId,
        userId: bossId,
        role: "commenter",
        addedBy: ownerId,
        createdAt: 2,
      }),
    );
    const boss = t.withIdentity({ subject: bossId });

    const projects = await boss.query(api.projects.list, { organizationId });
    expect(projects.map((project) => project._id)).toEqual([workProjectId]);
    await expect(boss.query(api.projects.detail, { projectId: personalProjectId })).rejects.toThrow(
      /project not found/i,
    );
  });

  test("project invitation joins workspace but grants only its project", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, organizationId, workProjectId, personalProjectId } =
      await seedWorkspaceWithPrivateProjects(t);
    const invitedId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Reviewer", email: "reviewer@example.com" }),
    );
    const owner = t.withIdentity({ subject: ownerId });
    const invitationId = await owner.mutation(api.projectAccess.requestInvitation, {
      projectId: workProjectId,
      email: "reviewer@example.com",
      role: "viewer",
      rawToken: "mmv_invite-hash",
    });
    const invitation = await t.run((ctx) => ctx.db.get(invitationId));
    const invited = t.withIdentity({ subject: invitedId });
    await invited.mutation(api.projectAccess.acceptInvitation, { tokenHash: invitation!.tokenHash });

    const projects = await invited.query(api.projects.list, { organizationId });
    expect(projects.map((project) => project._id)).toEqual([workProjectId]);
    await expect(invited.query(api.projects.detail, { projectId: personalProjectId })).rejects.toThrow(
      /project not found/i,
    );
  });

  test("commenter opens and comments on assigned mock with account access", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, bossId, workProjectId, personalProjectId } =
      await seedWorkspaceWithPrivateProjects(t);
    await t.run((ctx) =>
      ctx.db.insert("projectMemberships", {
        projectId: workProjectId,
        userId: bossId,
        role: "commenter",
        addedBy: ownerId,
        createdAt: 2,
      }),
    );
    const boss = t.withIdentity({ subject: bossId });
    const workProject = await t.run((ctx) => ctx.db.get(workProjectId));
    const personalProject = await t.run((ctx) => ctx.db.get(personalProjectId));
    await t.withIdentity({ subject: ownerId }).mutation(api.projectAccess.addOrigin, {
      projectId: workProjectId,
      origin: "https://preview.example",
    });
    const { token } = await boss.action(api.previewSessions.createForProject, {
      projectKey: workProject!.projectKey,
      origin: "https://preview.example",
    });
    await expect(
      boss.action(api.previewSessions.createForProject, {
        projectKey: workProject!.projectKey,
        origin: "https://attacker.example",
      }),
    ).rejects.toThrow(/not authorized/i);
    await t.action(api.publicApi.createThread, {
      token,
      projectKey: workProject!.projectKey,
      pageKey: "preview.example/work",
      path: "/work",
      title: "Work",
      x: 0.2,
      y: 0.3,
      viewportWidth: 1200,
      viewportHeight: 800,
      body: "Move this section.",
    });
    const result: any = await t.action(api.publicApi.readMock, {
      token,
      projectKey: workProject!.projectKey,
    });
    expect(result.threads[0].messages[0]).toMatchObject({
      authorName: "Boss",
      authorEmail: "boss@example.com",
    });
    await expect(
      t.action(api.publicApi.readMock, {
        token,
        projectKey: personalProject!.projectKey,
      }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  test("viewer can read but cannot comment", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, bossId, workProjectId } = await seedWorkspaceWithPrivateProjects(t);
    await t.run((ctx) =>
      ctx.db.insert("projectMemberships", {
        projectId: workProjectId,
        userId: bossId,
        role: "viewer",
        addedBy: ownerId,
        createdAt: 2,
      }),
    );
    const boss = t.withIdentity({ subject: bossId });
    const { token } = await boss.action(api.previewSessions.create, { projectId: workProjectId });
    const project = await t.run((ctx) => ctx.db.get(workProjectId));
    await expect(
      t.action(api.publicApi.readMock, { token, projectKey: project!.projectKey }),
    ).resolves.toMatchObject({ threads: [] });
    await expect(
      t.action(api.publicApi.createThread, {
        token,
        projectKey: project!.projectKey,
        pageKey: "preview.example/work",
        path: "/work",
        title: "Work",
        x: 0.2,
        y: 0.3,
        viewportWidth: 1200,
        viewportHeight: 800,
        body: "Should fail.",
      }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  test("removing project access invalidates an existing preview session", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, bossId, workProjectId } = await seedWorkspaceWithPrivateProjects(t);
    const membershipId = await t.run((ctx) =>
      ctx.db.insert("projectMemberships", {
        projectId: workProjectId,
        userId: bossId,
        role: "viewer",
        addedBy: ownerId,
        createdAt: 2,
      }),
    );
    const boss = t.withIdentity({ subject: bossId });
    const { token } = await boss.action(api.previewSessions.create, { projectId: workProjectId });
    await t.withIdentity({ subject: ownerId }).mutation(api.projectAccess.remove, { membershipId });
    const project = await t.run((ctx) => ctx.db.get(workProjectId));
    await expect(
      t.action(api.publicApi.readMock, { token, projectKey: project!.projectKey }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  test("workspace member can create and switch to an independent workspace", async () => {
    const t = convexTest(schema, modules);
    const { bossId } = await seedWorkspaceWithPrivateProjects(t);
    const boss = t.withIdentity({ subject: bossId });
    await boss.mutation(api.workspaces.create, { name: "Boss Private" });

    const workspaces = await boss.query(api.workspaces.mine, {});
    expect(workspaces.map((item) => item.organization?.name).sort()).toEqual([
      "Boss Private",
      "Workspace W",
    ]);
  });

  test("workspace admin without project assignment cannot manage project tokens", async () => {
    const t = convexTest(schema, modules);
    const { bossId, workProjectId } = await seedWorkspaceWithPrivateProjects(t);
    await expect(
      t.withIdentity({ subject: bossId }).action(api.tokens.create, {
        projectId: workProjectId,
        label: "Unauthorized CLI credential",
      }),
    ).rejects.toThrow(/project not found/i);
  });

  test("non-admin project members cannot view or manage token metadata", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, bossId, workProjectId } = await seedWorkspaceWithPrivateProjects(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("projectMemberships", {
        projectId: workProjectId,
        userId: bossId,
        role: "commenter",
        addedBy: ownerId,
        createdAt: 2,
      });
      await ctx.db.insert("accessTokens", {
        projectId: workProjectId,
        kind: "installation",
        label: "Private CLI",
        tokenHash: "private-hash",
        tokenPrefix: "mmi_private",
        createdBy: ownerId,
        createdAt: 2,
      });
    });
    const boss = t.withIdentity({ subject: bossId });
    const detail = await boss.query(api.projects.detail, { projectId: workProjectId });
    expect(detail.tokens).toEqual([]);
    await expect(
      boss.action(api.tokens.create, {
        projectId: workProjectId,
        label: "Forbidden CLI",
      }),
    ).rejects.toThrow(/project not found/i);
  });

  test("wrong-email and expired project invitations are rejected", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, workProjectId } = await seedWorkspaceWithPrivateProjects(t);
    const wrongUserId = await t.run((ctx) =>
      ctx.db.insert("users", { name: "Wrong", email: "wrong@example.com" }),
    );
    const owner = t.withIdentity({ subject: ownerId });
    const invitationId = await owner.mutation(api.projectAccess.requestInvitation, {
      projectId: workProjectId,
      email: "right@example.com",
      role: "commenter",
      rawToken: "mmv_wrong-email-invite",
    });
    const invitation = await t.run((ctx) => ctx.db.get(invitationId));
    await expect(
      t.withIdentity({ subject: wrongUserId }).mutation(api.projectAccess.acceptInvitation, {
        tokenHash: invitation!.tokenHash,
      }),
    ).rejects.toThrow(/invited email/i);
    await t.run((ctx) => ctx.db.patch(invitationId, { expiresAt: Date.now() - 1 }));
    await expect(
      t.withIdentity({ subject: wrongUserId }).mutation(api.projectAccess.acceptInvitation, {
        tokenHash: invitation!.tokenHash,
      }),
    ).rejects.toThrow(/invalid or expired/i);
  });

  test("removing workspace membership also removes project access", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, bossId, organizationId, workProjectId } =
      await seedWorkspaceWithPrivateProjects(t);
    await t.run((ctx) =>
      ctx.db.insert("projectMemberships", {
        projectId: workProjectId,
        userId: bossId,
        role: "viewer",
        addedBy: ownerId,
        createdAt: 2,
      }),
    );
    const workspaceMembership = await t.run((ctx) =>
      ctx.db
        .query("memberships")
        .withIndex("by_org_user", (q) =>
          q.eq("organizationId", organizationId).eq("userId", bossId),
        )
        .unique(),
    );
    await t.withIdentity({ subject: ownerId }).mutation(api.workspaces.removeMember, {
      membershipId: workspaceMembership!._id,
    });
    await expect(
      t.withIdentity({ subject: bossId }).query(api.projects.detail, { projectId: workProjectId }),
    ).rejects.toThrow(/project not found/i);
  });

  test("unauthenticated users cannot discover or open projects", async () => {
    const t = convexTest(schema, modules);
    const { organizationId, workProjectId } = await seedWorkspaceWithPrivateProjects(t);
    await expect(t.query(api.projects.list, { organizationId })).rejects.toThrow(/authentication/i);
    await expect(t.query(api.projects.detail, { projectId: workProjectId })).rejects.toThrow(
      /authentication/i,
    );
  });
});
