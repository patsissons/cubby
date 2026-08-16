---
description: Bootstrap a new cubby deployment repo (create, clone with shared history, wire remotes, push)
argument-hint: <owner/name> [--public] [--upstream owner/repo]
---

Bootstrap a cubby deployment repo from this request: $ARGUMENTS

Follow the cubby-init skill (skills/cubby-init/SKILL.md) exactly: confirm
repo name, visibility, and upstream with the user if not given; create the
GitHub repo only if it does not exist; clone the upstream cubby repo so git
history is shared; set the upstream and origin remotes; push main; then
direct the user to the cubby-deploy skill for instance setup.
