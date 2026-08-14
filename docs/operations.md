# Mockmark Operations

## Required production configuration

- Personal Convex access to the intended team/project and production deployment.
- Convex Auth `JWT_PRIVATE_KEY` and `JWKS` environment variables.
- Static hosting project for `dist-web`, connected only to a personal account.
- `VITE_CONVEX_URL` set to the production Convex client URL during build.
- Custom domain and HTTPS before client onboarding.

## Deploy backend

```bash
npx convex deployment select dryve-team:mockmark:dev/<personal-member>
npx convex dev --once
npx convex deploy --cmd 'npm run build'
```

Confirm target team/project before either command. Do not deploy when CLI identity only exposes a work-owned profile.

Run `npm run auth:configure` once per selected deployment to generate Convex Auth signing keys. It writes keys directly through the Convex CLI and never prints them.

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
6. Authorize the deployed mock origin, assign a project commenter, then sign in from the mock.
7. Create, reply, react, resolve, and confirm CLI receives feedback.
8. Confirm a second repository without `.mockmark.json` remains unchanged.

## Incident controls

- Revoke compromised review or installation token.
- Remove member access at organization membership layer.
- Archive project to reject all token access.
- Inspect `auditEvents` for token, thread, member, and project actions.
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
- Tenant-crossing tests pass.
