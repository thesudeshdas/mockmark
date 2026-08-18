# Ideas

## Reposition feedback markers

**Status:** Feature request

Let reviewers drag an existing comment marker or region to a more accurate position on the mock without deleting or recreating its conversation.

Requirements:

- Support dragging point markers and selected regions within page bounds.
- Preserve conversation identity, messages, reactions, resolution state, author, and original creation time.
- Store updated normalized coordinates so placement remains stable across viewport sizes.
- Distinguish opening a conversation from moving its marker; expose a clear move handle or move mode.
- Optimistically update position, then restore the previous position if persistence fails.
- Support touch and keyboard repositioning, not pointer dragging alone.
- Restrict movement using explicit project-role and authorship rules.
- Record who moved the marker and when in the project audit trail.
- Handle concurrent moves deterministically and show the latest saved position.

Open design work: who may move another reviewer's marker, whether resolved comments remain movable, keyboard step size, region resize versus move scope, and whether position history should be visible or only audited.

## Agent-managed mock workspace

**Status:** Idea

Improve setup so mock organization becomes an automatic codebase convention, not a repeated prompting task.

Whenever a designer or engineer starts feature/design work that needs mocks, the codebase's AI agent should automatically:

- create or reuse a clear feature-oriented structure under `mocks/`;
- keep related screens, states, assets, and notes together;
- maintain a central mock index with understandable navigation across every feature;
- add links between related flows and states where useful;
- follow existing repository/domain naming conventions;
- update navigation when mocks are added, moved, renamed, or removed;
- ask only when ambiguity, collisions, or destructive changes require human judgment.

Goal: anyone can open one predictable entry point, understand available feature mocks, and navigate them without knowing repository history or giving the AI extra setup prompts.

Open design work: define default folder schema, navigation format, metadata, lifecycle rules, and agent instructions without forcing one structure onto every codebase.

## Safer existing-mock discovery and adoption

**Status:** Client requirement (Dryve)

Make `mockmark init` distinguish canonical product mocks from agent artifacts and generated deployment copies before proposing migration. Dryve exposed the failure mode: `docs/mockups` is the canonical source, `.codex/mockups` contains agent artifacts, and `waitlist-site/public/mocks` contains generated copies. Treating all three as migration sources risks duplicate hosted content and broken references.

Requirements:

- Detect generated, build, deployment, and output directories; exclude agent and system folders by default.
- Respect `.gitignore` plus configurable Mockmark ignore rules during discovery.
- Detect source-versus-copy duplicates using paths and content rather than presenting each copy as independent mock work.
- Let users interactively select discovered directories or individual files.
- Offer **Adopt existing folder in place** so a canonical folder can be configured without moving files.
- Require explicit selection of the canonical mock root when multiple plausible sources exist.
- Provide a dry-run listing planned moves, exclusions and reasons, collisions, duplicate-copy handling, and reference updates.
- Perform no filesystem mutations until the user explicitly confirms the reviewed plan.
- Preserve hierarchy, avoid duplicate hosted copies, and never classify agent/system folders as product mocks by default.

Open design work: ignore configuration format, duplicate-confidence thresholds, generated-copy signals, reference types eligible for automatic updates, and collision-resolution UX.

## Clear workspace-wide and project-only invitations

**Status:** Idea

Make invitation scope explicit. A project invite should grant access only to that project and reveal nothing about unassigned projects. A workspace invite should let the inviter choose whether access covers workspace administration only, selected projects, all current projects, or all current and future projects.

Default to least privilege. Do not silently grant every project through workspace membership. Clarify the current UI because standalone workspace Viewer/Commenter invitations provide no project access and are easy to misinterpret.

Open design work: define role inheritance, future-project behavior, bulk assignment, scope changes, removal semantics, and audit events.

## Organize and rename hosted deployments

**Status:** Idea

Make the hosted deployment list understandable as projects accumulate builds, without changing immutable deployment identities or breaking existing share URLs and feedback.

Requirements:

- Keep `npx mockmark deploy --label "Name"` as the initial display name. When omitted, retain the short commit SHA and `Mock deployment` fallbacks.
- Let project admins rename a deployment's display label inline from the Hosted mocks list.
- Treat renaming as metadata only. Deployment keys, asset paths, share URLs, markers, and conversations must remain unchanged.
- Add admin-managed folders or collections for grouping deployments. Moving a deployment between groups must not redeploy files or change URLs.
- Preserve the repository-relative file structure inside every deployment and show HTML pages as a navigable tree instead of opening only the first page.
- Let admins assign editable page display names while keeping underlying file paths immutable. Renaming a file path would create a different page identity and could split feedback.
- Keep existing deployments backward compatible: ungrouped by default, existing labels preserved, and current URLs unchanged.
- Record deployment-label, page-label, and grouping changes in the project audit trail.

Open design work: collection nesting depth, ordering, search/filter behavior, duplicate display names, rename permissions beyond admins, and whether collections should be shared across projects.
