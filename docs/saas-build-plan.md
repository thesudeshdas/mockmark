# Mockmark SaaS: Build Scope

## Product boundary

Mockmark is a repo-installed annotation and conversation layer for HTML web/mobile mocks. It stores feedback centrally and exposes that feedback to the team's existing AI agent. It does not design, recommend fixes, modify code, or prescribe workflow.

Payments are outside this scope.

## Core user flow

1. Admin creates an organization and project in Mockmark.
2. Developer installs Mockmark only in the chosen repository:

   ```bash
   npm install -D @thesudeshdas/mockmark
   npx mockmark init
   ```

3. CLI creates `.mockmark.json`, injects a hosted preview loader, and stores a project-scoped installation token outside the repository. No reusable secret is committed.
4. Team runs its normal mock/dev server. Mockmark appears only on pages built from that repository.
5. Explicitly assigned project members sign in from a deployed mock; commenters and admins can pin regions, comment, reply, react, mention teammates, resolve, or reopen threads.
6. Comments sync to Mockmark's hosted backend in real time.
7. AI agent runs `npx mockmark comments` to receive structured unresolved feedback. Agent decides what to do using the repository's own instructions.

## What must be built

### 1. Repository integration

- Replace copied client assets with the `@thesudeshdas/mockmark` package and `mockmark` CLI.
- `init`, `login`, `status`, `comments`, `open`, and `uninstall` commands.
- Framework-neutral browser bootstrap plus adapters for common Vite/Next.js setups.
- Dev/preview-only guard so Mockmark cannot accidentally ship into production.
- Stable project/page/build identity from config, route, Git branch, and commit SHA.

Package must remain thin. Hosted services own persistence, authorization, realtime sync, and business rules. Browser-delivered code remains inspectable; secrecy cannot be the security boundary.

### 2. Hosted annotation client

- Port current pins, regions, threads, replies, reactions, resolve/reopen, delete, hide, and list UI from `localStorage` to API-backed state.
- Add loading, offline, retry, conflict, expired-session, and permission states.
- Capture durable anchors: route, viewport, normalized coordinates, nearby DOM selector/text, build SHA, and optional screenshot crop.
- Responsive behavior for desktop and mobile mock previews.
- Accessibility, keyboard shortcuts, sanitization, and strict isolation from host-page CSS/JS.

### 3. Convex backend

- Organizations, memberships, projects, installations, builds, pages, review sessions, threads, messages, reactions, mentions, and audit events.
- Tenant-scoped queries/mutations with server-side authorization on every operation.
- Realtime subscriptions, pagination, soft deletion, retention controls, and attachment storage.
- Idempotent writes and schema migrations.
- Rate limits, payload limits, abuse controls, structured logs, monitoring, and backups.

### 4. Identity and access

- Email login initially; workspace roles plus explicit per-project `admin`, `commenter`, and `viewer` assignments.
- Short-lived dashboard sessions and revocable CLI installation tokens.
- Workspace membership alone reveals no projects. Project invitations may join a workspace while granting only their target project.
- Signed-in member preview sessions are short-lived and membership-backed. Browser review has no guest-token path.
- Project isolation: Codebase A credentials cannot read Codebase B.
- Session revocation, member removal, and audit trail.

### 5. Web dashboard

- Create/manage organizations, projects, members, installations, and review links.
- Browse builds/pages and search/filter conversations by status, author, mention, or date.
- Show install instructions and connection health.
- Export project feedback and delete project/workspace data.

### 6. Agent access

- CLI returns human-readable Markdown by default and versioned JSON on request.
- Filters: project, build, page, unresolved, mentioned user, and updated-since.
- Output contains feedback and source context only—no generated fix instructions.
- MCP adapter can follow later; CLI works with Claude, Codex, and other agents without controlling their workflow.

## Delivery order

1. Convex schema, auth, tenancy, and API contract.
2. Thin npm package/CLI with project linking and safe preview injection.
3. API-backed annotation UI and realtime conversations.
4. Agent-readable `comments` command.
5. Team dashboard, invites, mentions, and review links.
6. Security hardening, browser/integration tests, observability, docs, and production deployment.

## Release gate

Two separate repositories can install independently; comments never cross projects; unauthorized users cannot read/write; local and deployed previews work; concurrent reviewers sync correctly; an AI agent can retrieve unresolved feedback without receiving workflow advice; removing Mockmark leaves the host app unchanged.

Before release, replace the current MIT/backendless positioning and ensure distributed package contents match the proprietary product strategy.
