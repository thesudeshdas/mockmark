import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { audit } from "./lib/authz";

const scope = v.union(v.literal("workspace"), v.literal("project"));
const providerStatus = v.union(
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("bounced"),
  v.literal("failed"),
);

export const deliveryContext = internalQuery({
  args: { attemptId: v.id("invitationDeliveryAttempts") },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) return null;
    if (attempt.scope === "workspace") {
      const invitationId = ctx.db.normalizeId("invitations", attempt.invitationId);
      const invitation = invitationId ? await ctx.db.get(invitationId) : null;
      if (!invitation) return null;
      const [organization, inviter] = await Promise.all([
        ctx.db.get(invitation.organizationId),
        ctx.db.get(invitation.invitedBy),
      ]);
      if (!organization || !inviter) return null;
      return {
        attempt,
        invitation: {
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          acceptedAt: invitation.acceptedAt,
          revokedAt: invitation.revokedAt,
        },
        inviterName: inviter.name ?? inviter.email ?? "A Mockmark teammate",
        workspaceName: organization.name,
        projectName: undefined,
      };
    }
    const invitationId = ctx.db.normalizeId("projectInvitations", attempt.invitationId);
    const invitation = invitationId ? await ctx.db.get(invitationId) : null;
    if (!invitation) return null;
    const [organization, project, inviter] = await Promise.all([
      ctx.db.get(invitation.organizationId),
      ctx.db.get(invitation.projectId),
      ctx.db.get(invitation.invitedBy),
    ]);
    if (!organization || !project || !inviter) return null;
    return {
      attempt,
      invitation: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
      },
      inviterName: inviter.name ?? inviter.email ?? "A Mockmark teammate",
      workspaceName: organization.name,
      projectName: project.name,
    };
  },
});

export const deliver = internalAction({
  args: {
    attemptId: v.id("invitationDeliveryAttempts"),
    scope,
    invitationId: v.string(),
    rawToken: v.string(),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.invitationEmails.deliveryContext, {
      attemptId: args.attemptId,
    });
    if (!context || context.attempt.scope !== args.scope || context.attempt.invitationId !== args.invitationId)
      return;
    if (context.invitation.acceptedAt || context.invitation.revokedAt || context.invitation.expiresAt < Date.now())
      return;

    try {
      const config = resendConfig();
      const inviteUrl = invitationUrl(config.appUrl, args.scope, args.rawToken);
      const email = buildInvitationEmail({
        scope: args.scope,
        inviterName: context.inviterName,
        workspaceName: context.workspaceName,
        projectName: context.projectName,
        role: context.invitation.role,
        inviteUrl,
        expiresAt: context.invitation.expiresAt,
      });
      const providerEmailId = await sendWithRetry({
        apiKey: config.apiKey,
        from: config.from,
        replyTo: config.replyTo,
        to: context.invitation.email,
        idempotencyKey: context.attempt.idempotencyKey,
        ...email,
      });
      await ctx.runMutation(internal.invitationEmails.recordDeliveryResult, {
        attemptId: args.attemptId,
        status: "sent",
        providerEmailId,
        error: undefined,
      });
    } catch (error) {
      const message = safeError(error);
      await ctx.runMutation(internal.invitationEmails.recordDeliveryResult, {
        attemptId: args.attemptId,
        status: "failed",
        providerEmailId: undefined,
        error: message,
      });
      throw new Error(message);
    }
  },
});

export const recordDeliveryResult = internalMutation({
  args: {
    attemptId: v.id("invitationDeliveryAttempts"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    providerEmailId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt) return;
    await ctx.db.patch(attempt._id, {
      status: args.status,
      providerEmailId: args.providerEmailId,
      error: args.error,
      updatedAt: Date.now(),
    });
    const invitation = await invitationForAttempt(ctx, attempt);
    if (!invitation || (invitation.deliveryAttemptCount ?? 0) !== attempt.attempt) return;
    await ctx.db.patch(invitation._id, {
      deliveryStatus: args.status,
      lastDeliveryError: args.error,
    });
    await auditDelivery(ctx, attempt, invitation, `invitation.delivery_${args.status}`, {
      providerEmailId: args.providerEmailId,
      error: args.error,
      attempt: attempt.attempt,
    });
  },
});

export const recordWebhookEvent = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    providerEmailId: v.string(),
    occurredAt: v.number(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db.query("resendWebhookEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .unique();
    if (duplicate) return;
    await ctx.db.insert("resendWebhookEvents", {
      eventId: args.eventId,
      eventType: args.eventType,
      providerEmailId: args.providerEmailId,
      occurredAt: args.occurredAt,
      receivedAt: Date.now(),
    });
    const status = webhookStatus(args.eventType);
    if (!status) return;
    const attempts = await ctx.db.query("invitationDeliveryAttempts")
      .withIndex("by_provider_email", (q) => q.eq("providerEmailId", args.providerEmailId))
      .collect();
    for (const attempt of attempts) {
      await ctx.db.patch(attempt._id, {
        status,
        error: status === "bounced" || status === "failed" ? args.details : undefined,
        updatedAt: Date.now(),
      });
      const invitation = await invitationForAttempt(ctx, attempt);
      if (!invitation || (invitation.deliveryAttemptCount ?? 0) !== attempt.attempt) continue;
      await ctx.db.patch(invitation._id, {
        deliveryStatus: status,
        lastDeliveryError: status === "bounced" || status === "failed" ? args.details : undefined,
      });
      await auditDelivery(ctx, attempt, invitation, `invitation.${status}`, {
        providerEmailId: args.providerEmailId,
        eventId: args.eventId,
        details: args.details,
      });
    }
  },
});

export const expireInvitations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const workspaceInvitations = await ctx.db.query("invitations")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
      .take(500);
    for (const invitation of workspaceInvitations) {
      if (invitation.acceptedAt || invitation.revokedAt || invitation.expiredAt || invitation.expiresAt >= now) continue;
      await ctx.db.patch(invitation._id, { expiredAt: now });
      await audit(ctx, {
        organizationId: invitation.organizationId,
        action: "invitation.expired",
        targetType: "invitation",
        targetId: invitation._id,
        metadata: { email: invitation.email },
      });
    }
    const projectInvitations = await ctx.db.query("projectInvitations")
      .withIndex("by_expires_at", (q) => q.lt("expiresAt", now))
      .take(500);
    for (const invitation of projectInvitations) {
      if (invitation.acceptedAt || invitation.revokedAt || invitation.expiredAt || invitation.expiresAt >= now) continue;
      await ctx.db.patch(invitation._id, { expiredAt: now });
      await audit(ctx, {
        organizationId: invitation.organizationId,
        projectId: invitation.projectId,
        action: "project_invitation.expired",
        targetType: "projectInvitation",
        targetId: invitation._id,
        metadata: { email: invitation.email },
      });
    }
  },
});

export function buildInvitationEmail(args: {
  scope: "workspace" | "project";
  inviterName: string;
  workspaceName: string;
  projectName?: string;
  role: string;
  inviteUrl: string;
  expiresAt: number;
}) {
  const target = args.scope === "project" ? `project ${args.projectName}` : `workspace ${args.workspaceName}`;
  const scopeLabel = args.scope === "project" ? "Project only" : "Workspace administration only";
  const subject = `${args.inviterName} invited you to ${target}`;
  const expires = new Date(args.expiresAt).toUTCString();
  const text = [
    "You’re invited to Mockmark",
    "",
    `${args.inviterName} invited you to ${target}.`,
    `Workspace: ${args.workspaceName}`,
    ...(args.projectName ? [`Project: ${args.projectName}`] : []),
    `Role: ${args.role}`,
    `Scope: ${scopeLabel}`,
    `Expires: ${expires}`,
    "",
    `Accept invitation: ${args.inviteUrl}`,
    "",
    "This link is single-use. If you did not expect this invitation, ignore this email.",
  ].join("\n");
  const rows = [
    ["Workspace", args.workspaceName],
    ...(args.projectName ? [["Project", args.projectName]] : []),
    ["Role", args.role],
    ["Scope", scopeLabel],
    ["Expires", expires],
  ].map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:#756e63">${escapeHtml(label)}</td><td style="padding:6px 0;font-weight:600">${escapeHtml(value)}</td></tr>`).join("");
  const html = `<div style="background:#f3f2ee;padding:32px;font-family:Inter,Arial,sans-serif;color:#24221f"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #ded8cc;border-radius:16px;padding:32px"><div style="font-size:14px;font-weight:800;color:#ee5b35;letter-spacing:.08em">MOCKMARK</div><h1 style="font-size:28px;margin:20px 0 10px">You’re invited</h1><p style="line-height:1.6">${escapeHtml(args.inviterName)} invited you to ${escapeHtml(target)}.</p><table style="border-collapse:collapse;margin:20px 0">${rows}</table><a href="${escapeHtml(args.inviteUrl)}" style="display:inline-block;background:#ee5b35;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:9px">Accept invitation</a><p style="font-size:12px;color:#756e63;line-height:1.5;margin-top:24px">This link is single-use. If you did not expect this invitation, ignore this email.</p></div></div>`;
  return { subject, text, html };
}

export async function verifyResendWebhook(args: {
  payload: string;
  id: string;
  timestamp: string;
  signature: string;
  secret: string;
  now?: number;
}) {
  const timestamp = Number(args.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs((args.now ?? Date.now()) / 1000 - timestamp) > 300)
    return false;
  const secret = args.secret.replace(/^whsec_/, "");
  let keyBytes: Uint8Array;
  try { keyBytes = Uint8Array.from(atob(secret), (char) => char.charCodeAt(0)); }
  catch { return false; }
  const keyData = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
  const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${args.id}.${args.timestamp}.${args.payload}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return args.signature.split(" ").some((candidate) => candidate === `v1,${expected}`);
}

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  const appUrl = process.env.MOCKMARK_APP_URL;
  if (!apiKey || !from || !appUrl)
    throw new ConvexError("Resend is not configured. Set RESEND_API_KEY, RESEND_FROM, and MOCKMARK_APP_URL.");
  const url = new URL(appUrl);
  if (!/^https?:$/.test(url.protocol)) throw new ConvexError("MOCKMARK_APP_URL must use HTTP(S).");
  return { apiKey, from, appUrl: url.origin, replyTo: process.env.RESEND_REPLY_TO };
}

function invitationUrl(appUrl: string, inviteScope: "workspace" | "project", rawToken: string) {
  const url = new URL(appUrl);
  url.searchParams.set(inviteScope === "project" ? "project_invite" : "invite", rawToken);
  return url.toString();
}

async function sendWithRetry(args: {
  apiKey: string;
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await sendResendEmail(args); }
    catch (error) {
      lastError = error;
      if (!(error instanceof ResendError) || !error.retryable || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
    }
  }
  throw lastError;
}

async function sendResendEmail(args: {
  apiKey: string;
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${args.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": args.idempotencyKey,
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
    }),
  });
  const body = await response.json().catch(() => ({})) as { id?: string; message?: string; name?: string };
  if (!response.ok || !body.id)
    throw new ResendError(body.message || `Resend returned HTTP ${response.status}.`, response.status === 429 || response.status >= 500);
  return body.id;
}

class ResendError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

function webhookStatus(eventType: string): "sent" | "delivered" | "bounced" | "failed" | null {
  if (eventType === "email.sent") return "sent";
  if (eventType === "email.delivered") return "delivered";
  if (eventType === "email.bounced") return "bounced";
  if (eventType === "email.failed" || eventType === "email.suppressed") return "failed";
  return null;
}

async function invitationForAttempt(ctx: any, attempt: { scope: "workspace" | "project"; invitationId: string }) {
  const table = attempt.scope === "workspace" ? "invitations" : "projectInvitations";
  const id = ctx.db.normalizeId(table, attempt.invitationId);
  return id ? ctx.db.get(id) : null;
}

async function auditDelivery(ctx: any, attempt: any, invitation: any, action: string, metadata: unknown) {
  await audit(ctx, {
    organizationId: invitation.organizationId,
    ...(attempt.scope === "project" ? { projectId: invitation.projectId } : {}),
    action,
    targetType: attempt.scope === "project" ? "projectInvitation" : "invitation",
    targetId: invitation._id,
    metadata,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Invitation email failed.").slice(0, 500);
}
