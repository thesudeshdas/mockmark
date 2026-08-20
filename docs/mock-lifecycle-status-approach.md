# Mock Lifecycle Status: Approach

## Goal

Let teams distinguish mocks awaiting feedback, reviewed, completed, or retired. Status belongs to each HTML mock path, not its deployment or feedback threads. Deployments describe published builds; thread resolution describes conversations. Neither represents mock lifecycle.

## Status model

Use five states:

- `mocking`: implementation is underway.
- `ready_to_review`: available for feedback.
- `in_review`: at least one comment exists on the mock.
- `reviewed`: review is complete.
- `archived`: mock is retired.

Normal flow is `mocking → ready_to_review → in_review → reviewed → archived`. Reopening moves `reviewed` to `mocking` or `ready_to_review`, based on rework.

`in_review` is automatic, triggered by first comment. However, no-comment approval is valid; an admin may move `ready_to_review` directly to `reviewed`.

## Permissions

| Action | Admin | Commenter | Viewer | System |
|---|---:|---:|---:|---:|
| Set Mocking | Yes | Yes | No | No |
| Set Ready to review | Yes | Yes | No | No |
| Enter In review | No | No | No | First visible comment |
| Mark Reviewed | Yes | No | No | No |
| Archive or restore | Yes | No | No | No |

Commenters can prepare and review mocks, but cannot declare acceptance. Viewers remain read-only. Every transition records actor, previous status, next status, and timestamp.

## Data and dashboard

Add `mockRecords`, keyed by project and normalized path. Persist status across deployments when that identity matches. New paths default to `mocking`; missing paths never auto-archive. Renames require explicit transfer.

Show status badges, counts, filters, and actions beside each mock. Default filter should show Mocking, Ready to review, and In review. Keep feedback counts separate. Validate permissions, automatic transitions, no-comment approval, reopening, archival, deployment persistence, concurrent updates, audit events, and renamed or missing paths.
