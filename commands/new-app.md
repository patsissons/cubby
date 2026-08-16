---
description: Scaffold and build a new cubby app from a name and short description
argument-hint: <name>: <description>
---

Build a new cubby app from this request: $ARGUMENTS

Follow the cubby-new-app skill (skills/cubby-new-app/SKILL.md) exactly:
scaffold with `npm run new-app`, implement the requested behavior using the
cubby foundation APIs, add app-prefixed migrations only if the app needs its
own collections, verify with `npm run dev`, and keep the change set to the
skill's PR shape (one app directory, optional app migrations, regenerated
sites.json).
