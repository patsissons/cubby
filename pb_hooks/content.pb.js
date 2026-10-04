/// <reference path="../.pb/pb_data/types.d.ts" />
// Agent-readable content: a markdown snapshot of what a page shows, for
// agents that fetch with curl and cannot run the JavaScript that renders it.
//
//   GET /_cubby/content         the discovery site: every visible app
//   GET /_cubby/content/{app}   one app's static page converted to markdown,
//                               plus the sections its optional
//                               pb_hooks/apps/<app>/content.js fills in
//   GET /_cubby/content/{app}/{route...}
//                               one view of the app: the deep link
//                               /<app>/#/<route> spelled as a path, answered
//                               by content.js route(ctx), else 404
//                               route_not_found
//
// Public on purpose: a snapshot holds only what an anonymous browser could
// already see. A content hook reads only the rows a collection's listRule
// admits for a signed-out request (ctx.publicRecords). An app whose
// cubby.json declares an "access" block gets a 403 identity_required and no
// content. The build advertises the endpoint in every page's <head> (link
// rel=alternate type=text/markdown) and in llms.txt. The flow lives in
// pb_hooks/lib/content.js; this file only registers the routes. Handlers
// require everything per request because JSVM contexts are isolated. The
// JSVM caches required modules, so an edit to an app's content.js needs a
// server restart (PocketHost: power cycle).

routerAdd('GET', '/_cubby/content', (e) => require(`${__hooks}/lib/content.js`).serve(e, ''))
routerAdd('GET', '/_cubby/content/{app}', (e) =>
  require(`${__hooks}/lib/content.js`).serve(e, e.request.pathValue('app'))
)
routerAdd('GET', '/_cubby/content/{app}/{route...}', (e) =>
  require(`${__hooks}/lib/content.js`).serve(e, e.request.pathValue('app'), e.request.pathValue('route'))
)
