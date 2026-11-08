/// <reference path="../.pb/pb_data/types.d.ts" />
// Server-rendered permalinks: the one exception to "routing (there is none)".
// An app that declares a "permalink" block in its cubby.json gets a real
// GET /<app>/{slug} route that serves the app's own index.html shell with
// <title> and OpenGraph tags rewritten for that slug, so pasted links unfurl
// in messaging apps (their crawlers do not execute JS). The client app then
// hydrates from location.pathname as usual.
//
// The tags come from the matching record (record mode: "collection") or from
// the app's own pb_hooks/apps/<app>/permalink.js (hook mode: "hook": true),
// for links whose content is computed from the slug rather than stored. The
// app module only answers "what should this slug say"; serving, escaping,
// clamping, caching, <base> and not-found handling stay here.
//
// Routes are registered at boot from the committed manifests, so declaring a
// permalink in a NEW app needs a server restart (PocketHost: power cycle),
// like any hook change. Everything else (manifest, shell, record) is read per
// request. Handlers are self-contained because the JSVM executes them in
// isolated contexts: no closures over registration state.
//
// The slug pattern is deliberately dot-free so the app's real static files
// (style.css, app.js, llms.txt...) fall through to normal file serving, and
// permalink collections should constrain their slug field to match. On
// permalink pages a <base href="/<app>/"> is injected so the shell's relative
// asset URLs still resolve; apps declaring permalinks must therefore write
// internal links absolute (e.g. "/myapp/#/edit/x", not "#/edit/x").

function servePermalink(e) {
  const lib = require(`${__hooks}/lib/permalink.js`)
  const { loadCubbyConfig } = require(`${__hooks}/lib/config.js`)
  const publicDir = `${__hooks}/../pb_public`

  const parts = e.request.url.path.split('/').filter(Boolean)
  const app = parts[0]

  // Registering GET /<app>/ (the "home" permalink) makes Go's router treat
  // it as a subtree pattern, so deeper paths that /<app>/{slug} cannot match
  // (/app/data/x.json) land here too: anything beyond one segment is a real
  // static file.
  if (parts.length > 2) {
    return e.fileFS($os.dirFS(publicDir), parts.join('/'))
  }

  const pl = lib.loadAppPermalink(app)

  // GET /<app>/ (registered only when the manifest declares "home") serves
  // the app root with the home slug's OG data; the shell needs no <base>
  // because the document base already is /<app>/.
  const isHome = !parts[1]
  const slug = isHome ? (pl && pl.home) || '' : parts[1]

  // Asset-like segments (anything a slug cannot be) are real files.
  if (!isHome && !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return e.fileFS($os.dirFS(publicDir), `${app}/${slug}`)
  }

  let shell = toString($os.readFile(`${publicDir}/${app}/index.html`))
  if (!isHome) shell = shell.replace('<head>', `<head>\n    <base href="/${app}/" />`)

  const config = loadCubbyConfig()
  const origin = String(config.domain || config.instanceUrl || '').replace(/\/+$/, '')

  // { title, description, image } for this slug, or null when there is none.
  let meta = null
  if (pl && slug && pl.hook) {
    try {
      const resolver = require(`${__hooks}/apps/${app}/permalink.js`)
      meta = lib.hookMeta(resolver.resolve({ app, slug, isHome, origin, request: e.request }), origin)
    } catch (err) {
      // A broken resolver must not take the app down: serve the untouched
      // shell (static OG) so humans still get the app, uncached, and a 500 so
      // crawlers don't unfurl it (the app root stays a 200, as below).
      console.log(`[permalinks] ${app}/permalink.js resolve("${slug}") failed:`, err)
      e.response.header().set('Cache-Control', 'no-store')
      return e.html(isHome ? 200 : 500, shell)
    }
  } else if (pl && slug) {
    let record = null
    try {
      const filter = pl.filter
        ? `${pl.param} = {:slug} && (${pl.filter})`
        : `${pl.param} = {:slug}`
      record = e.app.findFirstRecordByFilter(pl.collection, filter, { slug })
    } catch (err) {
      record = null
    }
    if (record) {
      meta = {
        title: lib.stripMarkdown(lib.renderTemplate(pl.title, record), 120),
        description: lib.stripMarkdown(lib.renderTemplate(pl.description, record)),
      }
      const file = pl.image ? record.getString(pl.image) : ''
      if (file) {
        // Content stamp: unfurl crawlers and CDNs cache og:image aggressively,
        // so key the URL to the record's last edit (falls back to a stable
        // filename-only stamp when the collection has no `updated` field).
        const stamp = $security.md5(`${file}:${record.getString('updated')}`).slice(0, 8)
        const thumb = pl.imageThumb ? `thumb=${pl.imageThumb}&` : ''
        meta.image = `${origin}/api/files/${pl.collection}/${record.id}/${file}?${thumb}v=${stamp}`
      }
      // else: the build already rewrote the static og:image to an absolute URL.
    }
  }

  if (!meta && isHome) {
    // The app root must never 404: without a home record (nothing shared
    // yet) serve the untouched shell with its static OG block.
    e.response.header().set('Cache-Control', 'public, max-age=300')
    return e.html(200, shell)
  }
  if (!meta) {
    // Serve the shell so humans get the app's own not-found UI, but with a
    // 404 (and no caching) so crawlers do not unfurl a dead link.
    e.response.header().set('Cache-Control', 'no-store')
    return e.html(404, shell)
  }

  meta.url = isHome ? `${origin}/${app}/` : `${origin}/${app}/${slug}`
  shell = lib.applyOg(shell, meta)

  // Bound CDN staleness explicitly; edge behavior for hook routes is not the
  // same as for pb_public files.
  e.response.header().set('Cache-Control', 'public, max-age=300')
  return e.html(200, shell)
}

for (const app of require(`${__hooks}/lib/permalink.js`).permalinkApps()) {
  routerAdd('GET', `/${app}/{slug}`, servePermalink)
  const pl = require(`${__hooks}/lib/permalink.js`).loadAppPermalink(app)
  if (pl && pl.home) routerAdd('GET', `/${app}/`, servePermalink)
}
