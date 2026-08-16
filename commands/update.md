---
description: Merge the latest upstream cubby platform updates into this deployment and roll them out
argument-hint: [--upstream owner/repo]
---

Update this cubby deployment from upstream: $ARGUMENTS

Follow the cubby-update skill (skills/cubby-update/SKILL.md) exactly:
preview the incoming changes (read the decisions/architecture diffs first),
merge upstream/main, resolve any conflicts by the skill's ownership table,
rebuild artifacts with npm run build, verify locally, ship, and verify the
live instance.
