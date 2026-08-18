# Ideas

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
