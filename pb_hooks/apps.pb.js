/// <reference path="../.pb/pb_data/types.d.ts" />
// App hook loader. PocketBase only auto-loads *.pb.js files at the top level
// of pb_hooks/, so app-specific hooks live at pb_hooks/apps/<slug>/*.pb.js
// and are required here at boot. This keeps the platform/app boundary clean:
// this file is platform (generic, never edited per app); everything under
// pb_hooks/apps/ belongs to the app that owns the slug and ships in its PR.
// One app's broken hook must not take down the rest, hence the per-app catch.
try {
  for (const entry of $os.readDir(`${__hooks}/apps`)) {
    if (!entry.isDir()) continue
    const slug = entry.name()
    if (!/^[a-z0-9-]+$/.test(slug)) continue
    try {
      for (const file of $os.readDir(`${__hooks}/apps/${slug}`)) {
        const name = file.name()
        if (file.isDir() || !name.endsWith('.pb.js')) continue
        require(`${__hooks}/apps/${slug}/${name}`)
      }
    } catch (err) {
      console.log(`[apps] failed to load hooks for app "${slug}":`, err)
    }
  }
} catch (err) {
  // no pb_hooks/apps/ directory: nothing to load
}
