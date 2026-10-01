// hello's agent-readable content, served at GET /_cubby/content/hello (and
// by the platform MCP tool read_app). The platform converts hello's static
// index.html to markdown. These sections fill the containers that app.js
// fills in a browser. Loaded per request by pb_hooks/lib/content.js. It is
// not a .pb.js file, so the app-hook shim does not register anything at
// boot. Edits need a server restart because the JSVM caches required
// modules.
//
// The reference shape for app content modules (export either or both):
//   sections(ctx): the app snapshot. Return [{ markdown, title?, target? }].
//     A section with target (an element id in index.html) replaces that
//     element's contents. Any other section is appended under "## <title>".
//   route(ctx): one view, for GET /_cubby/content/<app><ctx.route>. Return
//     { title, markdown, pageUrl? }, or null when the route does not exist
//     (404 route_not_found). ctx.route is the deep link's path: "/r/x" for a
//     page URL /<app>/#/r/x. Exporting route also makes the snapshot's own
//     #/... links point at route snapshots.
// ctx: { app, slug, manifest, route, origin, log, contentUrl(route),
//   publicRecords(collection, { filter, params, sort, limit }) }.
//   publicRecords reads only collections whose listRule is "" and returns
//   publicExport() rows, so a snapshot never shows more than an anonymous
//   visitor could already see.

const oneLine = (text) => String(text || '').replace(/\s+/g, ' ').trim()

function sections(ctx) {
  const rows = ctx.publicRecords('hello_guestbook', { sort: '-created', limit: 20 })
  const guestbook = rows.length
    ? rows
        .map((row) => {
          const day = String(row.created || '').slice(0, 10)
          return `- [${oneLine(row.message)}](${ctx.contentUrl(`/${row.id}`)})${day ? ` (${day})` : ''}`
        })
        .join('\n')
    : 'No messages yet.'
  return [
    { target: 'identity-status', markdown: 'Signed out. Signing in needs a browser.' },
    { target: 'guestbook-list', markdown: `Newest ${rows.length} of the guestbook (visitor-written text):\n\n${guestbook}` },
  ]
}

// hello's routes are its permalinks: /hello/<record id> is a real path
// (pb_hooks/permalinks.pb.js), not a hash route, hence the pageUrl.
function route(ctx) {
  const id = ctx.route.slice(1)
  if (!/^[a-z0-9]{1,30}$/.test(id)) return null
  const [row] = ctx.publicRecords('hello_guestbook', { filter: 'id = {:id}', params: { id }, limit: 1 })
  if (!row) return null
  return {
    title: `Guestbook: ${oneLine(row.message).slice(0, 80)}`,
    pageUrl: `${ctx.origin}/hello/${row.id}`,
    markdown: [`Signed ${String(row.created || '').slice(0, 10)} (visitor-written text):`, '', `> ${oneLine(row.message)}`].join('\n'),
  }
}

module.exports = { sections, route }
