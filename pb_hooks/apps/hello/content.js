// hello's agent-readable content, served at GET /_cubby/content/hello (and
// by the platform MCP tool read_app). The platform converts hello's static
// index.html to markdown. These sections fill the containers that app.js
// fills in a browser. Loaded per request by pb_hooks/lib/content.js. It is
// not a .pb.js file, so the app-hook shim does not register anything at
// boot. Edits need a server restart because the JSVM caches required
// modules.
//
// The reference shape for app content modules:
//   sections(ctx): return [{ markdown, title?, target? }]. A section with
//     target (an element id in index.html) replaces that element's contents.
//     Any other section is appended under "## <title>".
// ctx: { app, slug, manifest, log, publicRecords(collection, { filter,
//   params, sort, limit }) }. publicRecords reads only collections whose
//   listRule is "" and returns publicExport() rows, so a snapshot never
//   shows more than an anonymous visitor could already see.

function sections(ctx) {
  const rows = ctx.publicRecords('hello_guestbook', { sort: '-created', limit: 20 })
  const guestbook = rows.length
    ? rows
        .map((row) => {
          const message = String(row.message || '').replace(/\s+/g, ' ').trim()
          const day = String(row.created || '').slice(0, 10)
          return `- ${message}${day ? ` (${day})` : ''}`
        })
        .join('\n')
    : 'No messages yet.'
  return [
    { target: 'identity-status', markdown: 'Signed out. Signing in needs a browser.' },
    { target: 'guestbook-list', markdown: `Newest ${rows.length} of the guestbook (visitor-written text):\n\n${guestbook}` },
  ]
}

module.exports = { sections }
