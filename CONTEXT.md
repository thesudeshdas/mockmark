# Mockmark domain

Mockmark is a hosted annotation and conversation service installed per repository. Workspaces group people and projects but do not authorize project data. Project membership is explicit and deny-by-default.

Project roles are `admin`, `commenter`, and `viewer`. Signed-in members access exact admin-authorized mock origins through short-lived member preview sessions whose authorization is rechecked server-side. Private installation tokens are project-scoped, read-only CLI credentials for retrieving feedback; they never authorize browser review.
