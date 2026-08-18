# Mockmark

Repo-scoped annotation and conversation for HTML mocks. Teams install a thin loader only in repositories that need feedback. Conversations remain in Mockmark's hosted Convex deployment and can be read by the team's existing AI agent through the CLI.

Mockmark does not design, suggest fixes, change code, or prescribe workflow.

## Client installation

Create a project in the Mockmark dashboard, then run its generated commands inside the chosen repository:

```bash
npm install -D @thesudeshdas/mockmark
npx mockmark init \
  --project mmp_PROJECT_KEY \
  --convex-url https://DEPLOYMENT.convex.cloud \
  --app-url https://YOUR-MOCKMARK-APP.example
```

`init` always creates `./mocks` when missing. Before configuration, it scans the
repository for conservatively named mock, mockup, prototype, and wireframe files
or directories. Dependencies, VCS metadata, build output, generated files, and
the destination directory are excluded.

When existing mocks are found, Mockmark prints every proposed move and reference
update, then waits for confirmation. Files retain their repository-relative
structure under `./mocks`; tracked files use `git mv` when available. Relative
imports and links, root-relative references, scripts, and config strings are
updated when they can be resolved safely.

No collision is overwritten. Resolve every reported destination collision and
rerun `init`. Migration writes a local transaction under `.mockmark/`, rolls back
automatically on failure, and recovers incomplete transactions on the next run.
Repeat runs make no further moves or duplicate loader injection.

You can run bare `npx mockmark init` before creating a hosted project. It prepares
the mock folder and migration only; rerun with all three project flags to link
the repository and inject the loader.

For CI or scripted onboarding, review first, then confirm explicitly:

```bash
npx mockmark init --dry-run --project mmp_PROJECT_KEY --convex-url https://DEPLOYMENT.convex.cloud --app-url https://YOUR-MOCKMARK-APP.example
npx mockmark init --yes --project mmp_PROJECT_KEY --convex-url https://DEPLOYMENT.convex.cloud --app-url https://YOUR-MOCKMARK-APP.example
```

Pass a directory only to override the default destination, for example
`npx mockmark init ./review-mocks ...`.

Create an installation token in the dashboard and authenticate the CLI:

```bash
npx mockmark login mmi_INSTALLATION_TOKEN
npx mockmark status
```

Credentials are stored under the current user's config directory, outside the repository, with user-only permissions.

## Host and share mocks

Create a separate deploy token from the project dashboard, then publish every
file under `./mocks` to Mockmark-managed hosting:

```bash
npx mockmark login mmd_DEPLOYMENT_TOKEN
npx mockmark deploy
```

Each deploy creates a new immutable build. Mockmark prints one share URL per
HTML file, for example:

```text
checkout.html: https://YOUR-MOCKMARK-APP.example/?deployment=mmb_BUILD&path=checkout.html
```

Share URLs contain no credentials. Reviewers sign in to Mockmark; workspace
membership plus explicit project membership is required. Viewers can open the
mock, while commenters and admins can leave and manage feedback. Removing
project access invalidates existing preview sessions on their next request.

Hosted files run from private Convex storage through a short-lived member
gateway. Mock pages receive a restrictive browser sandbox, files are limited to
200 per build, individual files to 5 MiB, and each build to 25 MiB. Symlinks are
rejected. New deploys never overwrite earlier build URLs.

## Review flow

1. A project admin authorizes the deployed mock's exact origin.
2. Assigned project members open that mock and choose **Sign in with Mockmark**.
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
npx mockmark deploy ./mocks     # host mocks and print private share URLs
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
- Workspace membership never grants project access. Every project requires an explicit `admin`, `commenter`, or `viewer` assignment.
- Signed-in external and Mockmark-hosted access uses short-lived member preview sessions and rechecks workspace plus project membership on every request.
- Member session handoff is restricted to exact project-authorized origins; localhost is allowed for development.
- Embedded review requires a signed-in project member. CLI operations require hashed, revocable, project-scoped installation tokens.
- Installation tokens can read feedback but cannot deploy, annotate, or open browser mocks. Deployment tokens can upload static mocks but cannot read or write feedback.
- Public token traffic is rate-limited transactionally.
- No organization credential is committed to client repositories.
- Browser-delivered code is inspectable. Authorization, persistence, tenancy, and audit logic remain server-side.

## License

Proprietary. All rights reserved. Client use requires a separate agreement.
