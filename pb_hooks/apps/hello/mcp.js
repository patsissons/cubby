// hello's MCP tools, served at POST /_cubby/mcp/hello (bearer token from
// HELLO_MCP_TOKEN). Loaded per request by pb_hooks/mcp.pb.js; not a .pb.js
// file, so the app-hook shim does not register anything at boot. Edits
// still need a server restart (PocketHost: power cycle) because the JSVM
// caches required modules.
//
// The reference shape for app tool modules:
//   tools: MCP tool definitions (name, description, inputSchema, annotations)
//   call(name, args, ctx): return a string, an object (becomes JSON text plus
//     structuredContent), or { content: [...] } verbatim; throw an Error for
//     a tool failure the model should see; throw { code: 'invalid_params',
//     message } for a bad request (-32602).
// ctx: { app, slug, manifest, mcp, request, log }.

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const tools = [
  {
    name: 'echo',
    description: 'Echo the given text back. The smallest possible tool, for checking the connection.',
    inputSchema: {
      type: 'object',
      required: ['text'],
      properties: { text: { type: 'string', maxLength: 1000 } },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'guestbook_recent',
    description: 'The most recent guestbook entries (newest first) as { id, message, user, created }.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1, maximum: 50, description: 'default 10' } },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
]

function call(name, args, ctx) {
  switch (name) {
    case 'echo':
      return args.text
    case 'guestbook_recent': {
      const limit = Number.isInteger(args.limit) ? args.limit : 10
      const rows = ctx.app.findRecordsByFilter('hello_guestbook', "id != ''", '-created', limit, 0)
      const entries = []
      for (const row of rows) {
        entries.push({
          id: row.id,
          message: row.getString('message'),
          user: row.getString('user'),
          created: String(row.getString('created')),
        })
      }
      return { entries }
    }
    default:
      throw { code: 'invalid_params', message: `unknown tool "${name}"` }
  }
}

module.exports = { tools, call }
