# Mockmark domain

Mockmark is a hosted annotation and conversation service installed per repository. Workspaces group people and projects but do not authorize project data. Project membership is explicit and deny-by-default.

Project roles are `admin`, `commenter`, and `viewer`. Signed-in members access external admin-authorized mock origins or immutable Mockmark-hosted deployments through short-lived member preview sessions whose workspace and project authorization is rechecked server-side. Private installation tokens are project-scoped, read-only CLI credentials for retrieving feedback. Separate deployment tokens can upload static mock assets but cannot read or write feedback. Neither credential authorizes browser review.
