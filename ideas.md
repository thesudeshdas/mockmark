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
