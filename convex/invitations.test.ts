/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { buildInvitationEmail, verifyResendWebhook } from "./invitationEmails";
import schema from "./schema";

const modules = import.meta.glob(["./**/*.js", "./**/*.ts", "!./**/*.d.ts"]);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("RESEND_FROM", "Mockmark <invites@mockmark.test>");
  vi.stubEnv("MOCKMARK_APP_URL", "https://mockmark.test");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "email_123" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      name: "Owner Person",
      email: "owner@example.com",
    });
    const invitedId = await ctx.db.insert("users", {
      name: "Invited Person",
      email: "invited@example.com",
    });
    const organizationId = await ctx.db.insert("organizations", {
      name: "Acme Design",
      slug: "acme-design",
      createdBy: ownerId,
      createdAt: 1,
    });
    await ctx.db.insert("memberships", {
      organizationId,
      userId: ownerId,
      role: "owner",
      createdAt: 1,
    });
    const projectId = await ctx.db.insert("projects", {
      organizationId,
      name: "Web Platform",
      slug: "web-platform",
      projectKey: `mmp_${"a".repeat(36)}`,
      createdBy: ownerId,
      createdAt: 1,
    });
    await ctx.db.insert("projectMemberships", {
      projectId,
      userId: ownerId,
      role: "admin",
      addedBy: ownerId,
      createdAt: 1,
    });
    return { ownerId, invitedId, organizationId, projectId };
  });
}

describe("email invitations", () => {
  test("creates one active workspace invitation and requires explicit resend", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, organizationId } = await seed(t);
    const owner = t.withIdentity({ subject: ownerId });

    const invitationId = await owner.mutation(api.workspaces.requestInvitation, {
      organizationId,
      email: "Invited@Example.com",
      role: "commenter",
      rawToken: "mmv_first-token",
    });

    await expect(owner.mutation(api.workspaces.requestInvitation, {
      organizationId,
      email: "invited@example.com",
      role: "viewer",
      rawToken: "mmv_duplicate-token",
    })).rejects.toThrow(/active invitation already exists/i);

    const listed = await owner.query(api.workspaces.invitations, { organizationId });
    expect(listed).toEqual([
      expect.objectContaining({
        _id: invitationId,
        email: "invited@example.com",
        role: "commenter",
        status: "pending",
        deliveryAttemptCount: 1,
      }),
    ]);
  });

  test("builds scoped branded content without allowing HTML injection", () => {
    const email = buildInvitationEmail({
      scope: "project",
      inviterName: "Owner <script>",
      workspaceName: "Acme & Co",
      projectName: "Checkout",
      role: "commenter",
      inviteUrl: "https://mockmark.test/?project_invite=mmv_token",
      expiresAt: Date.UTC(2026, 7, 29),
    });
    expect(email.text).toContain("Project: Checkout");
    expect(email.text).toContain("Scope: Project only");
    expect(email.html).toContain("Owner &lt;script&gt;");
    expect(email.html).not.toContain("Owner <script>");
  });

  test("verifies Resend signatures and rejects tampering or replay", async () => {
    const secretBytes = new TextEncoder().encode("test-webhook-secret");
    const secret = `whsec_${btoa(String.fromCharCode(...secretBytes))}`;
    const payload = '{"type":"email.delivered"}';
    const id = "msg_test";
    const timestamp = "1800000000";
    const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
    const signature = `v1,${btoa(String.fromCharCode(...new Uint8Array(digest)))}`;
    const input = { payload, id, timestamp, signature, secret, now: 1_800_000_000_000 };

    await expect(verifyResendWebhook(input)).resolves.toBe(true);
    await expect(verifyResendWebhook({ ...input, payload: `${payload} ` })).resolves.toBe(false);
    await expect(verifyResendWebhook({ ...input, now: input.now + 301_000 })).resolves.toBe(false);
  });

  test("retries transient provider failures with one idempotency key", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockReset()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Try later" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "email_retry" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    const t = convexTest(schema, modules);
    const { ownerId, organizationId } = await seed(t);
    await t.withIdentity({ subject: ownerId }).mutation(api.workspaces.requestInvitation, {
      organizationId,
      email: "invited@example.com",
      role: "viewer",
      rawToken: "mmv_retry-token",
    });

    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstKey = new Headers(fetchMock.mock.calls[0][1]?.headers).get("idempotency-key");
    const secondKey = new Headers(fetchMock.mock.calls[1][1]?.headers).get("idempotency-key");
    expect(firstKey).toMatch(/^workspace-invitation\//);
    expect(secondKey).toBe(firstKey);
  });

  test("expires pending invitations and records the transition", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, organizationId } = await seed(t);
    const owner = t.withIdentity({ subject: ownerId });
    const invitationId = await owner.mutation(api.workspaces.requestInvitation, {
      organizationId,
      email: "invited@example.com",
      role: "viewer",
      rawToken: "mmv_expiry-token",
    });
    await t.run((ctx) => ctx.db.patch(invitationId, { expiresAt: Date.now() - 1 }));

    await t.mutation(internal.invitationEmails.expireInvitations, {});

    expect((await owner.query(api.workspaces.invitations, { organizationId }))[0].status).toBe("expired");
    expect(await t.run((ctx) => ctx.db.query("auditEvents")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.eq(q.field("action"), "invitation.expired"))
      .unique())).toBeTruthy();
  });

  test("resend rotates the token and revoke blocks acceptance", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, invitedId, organizationId } = await seed(t);
    const owner = t.withIdentity({ subject: ownerId });
    const invitationId = await owner.mutation(api.workspaces.requestInvitation, {
      organizationId,
      email: "invited@example.com",
      role: "viewer",
      rawToken: "mmv_first-token",
    });
    const before = await t.run((ctx) => ctx.db.get(invitationId));

    await owner.mutation(api.workspaces.resendInvitation, {
      invitationId,
      rawToken: "mmv_second-token",
    });
    const after = await t.run((ctx) => ctx.db.get(invitationId));
    expect(after?.tokenHash).not.toBe(before?.tokenHash);
    expect(after?.deliveryAttemptCount).toBe(2);

    await owner.mutation(api.workspaces.revokeInvitation, { invitationId });
    await expect(t.withIdentity({ subject: invitedId }).mutation(
      api.workspaces.acceptInvitation,
      { tokenHash: after!.tokenHash },
    )).rejects.toThrow(/invalid or expired/i);
    expect((await owner.query(api.workspaces.invitations, { organizationId }))[0].status).toBe("revoked");
  });

  test("verified provider events update delivery state once", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, organizationId } = await seed(t);
    const owner = t.withIdentity({ subject: ownerId });
    const invitationId = await owner.mutation(api.workspaces.requestInvitation, {
      organizationId,
      email: "invited@example.com",
      role: "viewer",
      rawToken: "mmv_webhook-token",
    });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const attempt = await t.run(async (ctx) => {
      const item = await ctx.db.query("invitationDeliveryAttempts")
        .withIndex("by_invitation", (q) => q.eq("scope", "workspace").eq("invitationId", invitationId))
        .unique();
      return item!;
    });

    await t.mutation(internal.invitationEmails.recordWebhookEvent, {
      eventId: "evt_1",
      eventType: "email.delivered",
      providerEmailId: "email_123",
      occurredAt: 100,
      details: undefined,
    });
    await t.mutation(internal.invitationEmails.recordWebhookEvent, {
      eventId: "evt_1",
      eventType: "email.delivered",
      providerEmailId: "email_123",
      occurredAt: 100,
      details: undefined,
    });

    expect(await t.run((ctx) => ctx.db.get(attempt._id))).toMatchObject({ status: "delivered" });
    expect((await owner.query(api.workspaces.invitations, { organizationId }))[0].status).toBe("delivered");
    expect(await t.run((ctx) => ctx.db.query("resendWebhookEvents").collect())).toHaveLength(1);
  });

  test("project invitations expose project scope and remain project-only", async () => {
    const t = convexTest(schema, modules);
    const { ownerId, invitedId, organizationId, projectId } = await seed(t);
    const owner = t.withIdentity({ subject: ownerId });
    const invitationId = await owner.mutation(api.projectAccess.requestInvitation, {
      projectId,
      email: "invited@example.com",
      role: "commenter",
      rawToken: "mmv_project-token",
    });
    const invitation = await t.run((ctx) => ctx.db.get(invitationId));

    await t.withIdentity({ subject: invitedId }).mutation(api.projectAccess.acceptInvitation, {
      tokenHash: invitation!.tokenHash,
    });

    expect((await owner.query(api.projectAccess.invitations, { projectId }))[0]).toMatchObject({
      projectName: "Web Platform",
      status: "accepted",
    });
    const memberships = await t.run((ctx) => ctx.db.query("projectMemberships")
      .withIndex("by_project_user", (q) => q.eq("projectId", projectId).eq("userId", invitedId))
      .collect());
    expect(memberships).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.query("memberships")
      .withIndex("by_org_user", (q) => q.eq("organizationId", organizationId).eq("userId", invitedId))
      .unique()))?.role).toBe("viewer");
  });
});
