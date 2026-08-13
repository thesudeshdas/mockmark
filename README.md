# Mockmark

Repo-scoped annotation and conversation for HTML mocks. Teams install a thin loader only in repositories that need feedback. Conversations remain in Mockmark's hosted Convex deployment and can be read by the team's existing AI agent through the CLI.

Mockmark does not design, suggest fixes, change code, or prescribe workflow.

## Client installation

Create a project in the Mockmark dashboard, then run its generated commands inside the chosen repository:

```bash
npm install -D mockmark
npx mockmark init ./mocks \
  --project mmp_PROJECT_KEY \
  --convex-url https://DEPLOYMENT.convex.cloud \
  --app-url https://YOUR-MOCKMARK-APP.example
```

This creates `.mockmark.json` and injects one hosted loader into HTML files under `./mocks`. It does not touch HTML elsewhere in the repository.

Create an installation token in the dashboard and authenticate the CLI:

```bash
npx mockmark login mmi_INSTALLATION_TOKEN
npx mockmark status
```

Credentials are stored under the current user's config directory, outside the repository, with user-only permissions.

## Review flow

1. Admin creates a time-limited review token in the dashboard.
2. Reviewer opens a configured mock with `?mockmark_token=mmr_...` once, or pastes the token into the Mockmark panel.
3. Press **C** to pin a point/region, **L** for all conversations, and **H** to hide markers.
4. Comments, replies, reactions, and resolution state sync to Convex.

The URL token is moved into `sessionStorage` and removed from browser history immediately. Review and installation tokens can be revoked independently.

## Agent feedback

Any agent with terminal access to the repository can read feedback without adopting a Mockmark workflow:

```bash
npx mockmark comments
npx mockmark comments --all
npx mockmark comments --json
npx mockmark comments --page localhost:4317/home.html --since 2026-08-01
```

Default output is Markdown containing source context and unresolved human conversation only. JSON output is versioned for automation.

## Other commands

```bash
npx mockmark inject ./mocks     # inject newly added HTML files
npx mockmark open               # print dashboard URL
npx mockmark uninstall ./mocks  # remove loaders; hosted feedback remains
```

## Development

Requirements: Node.js 20.19+.

```bash
npm install
CONVEX_AGENT_MODE=anonymous npx convex dev --once
npm run auth:configure
npm run dev
```

Quality gates:

```bash
npm run check
npm run build
npm run pack:check
```

Production requires the Convex project, Convex Auth JWT keys, and a static host for `dist-web`. Set `VITE_CONVEX_URL` during the web build. Deploy backend with `npx convex deploy`; deploy `dist-web` with the chosen personal hosting account.

See [docs/saas-build-plan.md](docs/saas-build-plan.md) and [docs/operations.md](docs/operations.md).

## Security boundary

- Every stored entity is project/organization scoped.
- Dashboard operations require authenticated membership and role checks.
- Embedded review and CLI operations require hashed, revocable, project-scoped tokens.
- No organization credential is committed to client repositories.
- Browser-delivered code is inspectable. Authorization, persistence, tenancy, and audit logic remain server-side.

## License

Proprietary. All rights reserved. Client use requires a separate agreement.
