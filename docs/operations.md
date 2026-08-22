# Mockmark Operations

## Required production configuration

- Personal Convex access to the intended team/project and production deployment.
- Convex Auth `JWT_PRIVATE_KEY` and `JWKS` environment variables.
- Resend `RESEND_API_KEY`, verified `RESEND_FROM`, public `MOCKMARK_APP_URL`, and webhook `RESEND_WEBHOOK_SECRET` environment variables.
- Optional `RESEND_REPLY_TO` environment variable when replies should go somewhere other than the sender identity.
- Static hosting project for `dist-web`, connected only to a personal account.
- `VITE_CONVEX_URL` set to the production Convex client URL during build.
- Custom domain and HTTPS before client onboarding.

Production dashboard origin: `https://mockmark.heywhoisdash.com`. Keep `https://mockmark.vercel.app` as a fallback alias and permitted hosted-preview frame ancestor.

## Deploy backend

```bash
npx convex deployment select dryve-team:mockmark:dev/<personal-member>
npx convex dev --once
npx convex deploy --cmd 'npm run build'
```

Confirm target team/project before either command. Do not deploy when CLI identity only exposes a work-owned profile.

Run `npm run auth:configure` once per selected deployment to generate Convex Auth signing keys. It writes keys directly through the Convex CLI and never prints them.

## Configure invitation email

Set these through Convex environment configuration, never repository files:

```bash
npx convex env set RESEND_API_KEY
npx convex env set RESEND_FROM
npx convex env set RESEND_REPLY_TO
npx convex env set MOCKMARK_APP_URL
npx convex env set RESEND_WEBHOOK_SECRET
```

`RESEND_FROM` must use a sender domain verified in Resend. `MOCKMARK_APP_URL` is the public dashboard origin used in single-use acceptance links.

Register `https://<deployment>.convex.site/webhooks/resend` in Resend for `email.sent`, `email.delivered`, `email.bounced`, `email.failed`, and `email.suppressed`. Copy its signing secret into `RESEND_WEBHOOK_SECRET`. Mockmark verifies the raw signed payload, rejects timestamps older than five minutes, and deduplicates webhook event IDs.

Invitation sends use one Resend idempotency key per delivery attempt. Transient `429` and `5xx` responses retry with the same key, preventing duplicate mail. Admins must explicitly resend failed, bounced, or expired invitations; resend rotates the single-use token and extends expiry by seven days.

## Deploy web

Deploy `dist-web` as a static site. Required routes/assets:

- `/` — authenticated dashboard
- `/embed.js` — cacheable embedded annotation runtime

Set SPA fallback to `/index.html`, but exclude `/embed.js` from fallback. Verify both return HTTP 200 with correct content types.

## Client onboarding

1. Owner signs up and creates workspace/project.
2. Owner generates CLI installation token.
3. Run dashboard-generated `mockmark init` command inside target repository.
4. Review discovered moves and reference updates. Resolve collisions; confirm only after the plan is correct. For automation, run `--dry-run` before `--yes`.
5. Run `npx mockmark login TOKEN` and `npx mockmark status`.
6. Create a deployment token, run `npx mockmark login mmd_TOKEN`, then `npx mockmark deploy`.
7. Open each printed share URL as an assigned viewer/commenter. Confirm an unassigned workspace member receives no project details.
8. Create, reply, react, resolve, and confirm CLI receives feedback.
9. Confirm a second repository without `.mockmark.json` remains unchanged.

## Incident controls

- Revoke compromised review or installation token.
- Remove member access at organization membership layer.
- Archive project to reject all token access.
- Inspect `auditEvents` for token, thread, member, and project actions.
- Inspect invitation status and `auditEvents` for creation, send, delivery, bounce/failure, resend, acceptance, expiry, and revocation.
- Installation tokens are private, project-scoped, and read-only. Browser review requires a signed-in project member.
- Public reads and writes are transactionally rate-limited per token.
- Convex backups and retention policy must be configured before production clients.

## Release checklist

- `npm run check`
- `npm run build`
- `npm run pack:check`
- `npm audit --omit=dev`
- Anonymous local Convex push succeeds.
- Real local browser smoke test passes.
- Production Convex functions and `/health` verified.
- Production dashboard and `/embed.js` verified.
- Fresh throwaway repository install/uninstall verified.
- Fresh throwaway repository deploy verified; each HTML share URL loads assets after project-member sign-in.
- Hosted asset requests fail after project membership removal or preview-session expiry.
- Tenant-crossing tests pass.
