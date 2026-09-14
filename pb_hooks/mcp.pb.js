/// <reference path="../.pb/pb_data/types.d.ts" />
// MCP (Model Context Protocol) endpoints, so external agent sessions (Claude
// Code and friends) can read and write app data through tools an app defines:
//
//   POST /_cubby/mcp         platform-wide read-only exploration tools
//                            (pb_hooks/lib/mcp-platform-tools.js), bearer
//                            token from CUBBY_MCP_TOKEN
//   POST /_cubby/mcp/{app}   that app's tools (pb_hooks/apps/<app>/mcp.js),
//                            enabled by an "mcp" block in its cubby.json,
//                            bearer token from <APP>_MCP_TOKEN
//
// Both are stateless Streamable HTTP servers: one JSON-RPC message (or
// legacy batch) per POST, plain application/json replies, no SSE, no
// sessions (GET/DELETE answer 405). Auth is a static bearer token compared
// in constant time; a 401 deliberately carries no WWW-Authenticate so MCP
// clients never start OAuth discovery against PocketBase. The whole flow
// lives in pb_hooks/lib/mcp.js (serve); this file only registers routes.
//
// Handlers are self-contained because the JSVM runs each in an isolated
// context: they require everything per request and close over nothing, not
// even a sibling function in this file. Tool modules are therefore loaded
// per request too. On PocketHost the instance hibernates when idle, so an
// agent's first call after a quiet spell pays the cold start.

routerAdd(
  'POST',
  '/_cubby/mcp',
  (e) => require(`${__hooks}/lib/mcp.js`).serve(e, ''),
  $apis.bodyLimit(1048576)
)
routerAdd(
  'POST',
  '/_cubby/mcp/{app}',
  (e) => require(`${__hooks}/lib/mcp.js`).serve(e, e.request.pathValue('app')),
  $apis.bodyLimit(1048576)
)
routerAdd('GET', '/_cubby/mcp', (e) => require(`${__hooks}/lib/mcp.js`).methodNotAllowed(e))
routerAdd('DELETE', '/_cubby/mcp', (e) => require(`${__hooks}/lib/mcp.js`).methodNotAllowed(e))
routerAdd('GET', '/_cubby/mcp/{app}', (e) => require(`${__hooks}/lib/mcp.js`).methodNotAllowed(e))
routerAdd('DELETE', '/_cubby/mcp/{app}', (e) => require(`${__hooks}/lib/mcp.js`).methodNotAllowed(e))
