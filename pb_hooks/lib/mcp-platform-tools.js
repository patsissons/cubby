// Platform MCP tools for POST /_cubby/mcp: read-only exploration of the
// deployment (apps, collections, records) for an agent holding the operator
// token (CUBBY_MCP_TOKEN). Same export shape as an app's mcp.js module.
// Runs in the PocketBase JSVM (goja): synchronous, CommonJS, no Node APIs.
//
// Reads go through the app's DAO, not the REST API, so hook-only collections
// (rules null) are readable too. That is intentional: the caller holds the
// operator token and this endpoint exists to let them look around. Filters
// are PocketBase filter expressions parsed by PocketBase, never raw SQL, and
// values must be bound with {:name} placeholders to keep them out of the
// expression text.

const COLLECTION_RE = /^[a-z][a-z0-9_]*$/
const PARAM_KEY_RE = /^[a-z_][a-z0-9_]*$/
const SORT_RE = /^[-+]?[a-zA-Z0-9_]+(,[-+]?[a-zA-Z0-9_]+)*$/
const MAX_FILTER = 1000
const MAX_PER_PAGE = 200

const mcp = {
  enabled: true,
  description: 'cubby platform explorer',
  instructions:
    'Read-only tools for exploring this cubby deployment. Start with list_apps, ' +
    'then describe_app for the manifest, collections and field schemas of one app. ' +
    'query_records takes a PocketBase filter expression; bind every value with a ' +
    '{:name} placeholder and pass the values in params (e.g. filter "user = {:u}", ' +
    'params { "u": "abc123" }). read_app returns the markdown snapshot of what an app\'s ' +
    'page shows (pages render in the browser, so their HTML is mostly a shell); the same ' +
    'text is public at GET /_cubby/content/<app>, and one view of a deep link ' +
    '/<app>/#/<route> at /_cubby/content/<app>/<route> (read_app route). Apps whose manifest declares "access" ' +
    'sit behind identity and have no snapshot. Apps that expose their own tools are ' +
    'served at /_cubby/mcp/<app> with that app\'s token.',
}

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }

const tools = [
  {
    name: 'list_apps',
    description:
      'List every app in this deployment (hidden apps included) with its manifest summary and whether it exposes MCP tools.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: readOnly,
  },
  {
    name: 'describe_app',
    description:
      'Describe one app: its full cubby.json manifest, every collection prefixed with its slug (rules, indexes, fields), ' +
      'the MCP tools it exposes, and whether its MCP token is configured (never the value).',
    inputSchema: {
      type: 'object',
      required: ['app'],
      properties: { app: { type: 'string', pattern: '^[a-z0-9-]{1,100}$', description: 'app slug (directory name)' } },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'read_app',
    description:
      'Read what an app\'s page shows, as markdown: its static HTML converted to text plus the live sections its ' +
      'content hook fills in (the page itself renders in the browser). The same text is public at ' +
      'GET /_cubby/content/<app>. Pass route to read one view: the deep link /<app>/#/r/x is route "/r/x" ' +
      '(route_not_found when the app has no content for it). Fails with identity_required for apps behind ' +
      'identity (manifest "access").',
    inputSchema: {
      type: 'object',
      required: ['app'],
      properties: {
        app: { type: 'string', pattern: '^[a-z0-9-]{1,100}$', description: 'app slug (directory name)' },
        route: { type: 'string', maxLength: 500, description: 'what follows /<app>/ in the page URL, e.g. "#/r/x" or "/r/x"' },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'list_collections',
    description: 'List collections (system and underscore-prefixed ones excluded), optionally only those starting with a prefix.',
    inputSchema: {
      type: 'object',
      properties: { prefix: { type: 'string', pattern: '^[a-z0-9_]{0,100}$', description: 'e.g. "hello_"' } },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'query_records',
    description:
      'Query records of a collection with a PocketBase filter expression (https://pocketbase.io/docs/api-rules-and-filters/). ' +
      'ALWAYS bind values with {:name} placeholders and supply them in params, e.g. filter "user = {:u} && created > {:since}" ' +
      'with params { "u": "id", "since": "2026-01-01 00:00:00" }. Hook-only collections are readable. ' +
      'Returns publicExport() of each record (hidden fields omitted).',
    inputSchema: {
      type: 'object',
      required: ['collection'],
      properties: {
        collection: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
        filter: { type: 'string', maxLength: MAX_FILTER, description: 'PocketBase filter expression with {:name} placeholders' },
        sort: { type: 'string', pattern: '^[-+]?[a-zA-Z0-9_]+(,[-+]?[a-zA-Z0-9_]+)*$', description: 'e.g. "-created,id"' },
        page: { type: 'integer', minimum: 1 },
        perPage: { type: 'integer', minimum: 1, maximum: MAX_PER_PAGE },
        params: {
          type: 'object',
          description: 'placeholder values (scalars only); keys must match ^[a-z_][a-z0-9_]*$',
        },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
  {
    name: 'get_record',
    description: 'Fetch one record by id. Returns publicExport() of the record (hidden fields omitted).',
    inputSchema: {
      type: 'object',
      required: ['collection', 'id'],
      properties: {
        collection: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
        id: { type: 'string', minLength: 1, maxLength: 100 },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
  },
]

function invalid(message) {
  return { code: 'invalid_params', message }
}

function str(value, fallback) {
  return typeof value === 'string' && value ? value : fallback
}

function readManifest(slug) {
  try {
    return JSON.parse(toString($os.readFile(`${__hooks}/../pb_public/${slug}/cubby.json`)))
  } catch (err) {
    return null
  }
}

/** Collections an operator may read: not system, not underscore-prefixed. */
function guardCollectionName(name) {
  if (typeof name !== 'string' || !COLLECTION_RE.test(name)) {
    throw invalid('collection must match ^[a-z][a-z0-9_]*$ (system and _-prefixed collections are not readable)')
  }
}

function findReadableCollection(app, name) {
  guardCollectionName(name)
  let collection
  try {
    collection = app.findCollectionByNameOrId(name)
  } catch (err) {
    throw new Error(`collection "${name}" not found`)
  }
  if (!collection || collection.system || String(collection.name).startsWith('_')) {
    throw invalid(`collection "${name}" is not readable through this endpoint`)
  }
  return collection
}

/**
 * A plain JSON snapshot of a collection model. goja honors MarshalJSON for
 * wrapped Go values, so this is the same shape the admin API returns.
 */
function collectionJson(collection) {
  return JSON.parse(JSON.stringify(collection))
}

function describeField(app, field) {
  const out = {
    name: field.name,
    type: field.type,
    required: !!field.required,
    hidden: !!field.hidden,
  }
  if (Array.isArray(field.values)) out.values = field.values
  if (typeof field.maxSelect === 'number' && field.maxSelect) out.maxSelect = field.maxSelect
  if (field.type === 'relation' && field.collectionId) {
    try {
      out.collection = app.findCollectionByNameOrId(field.collectionId).name
    } catch (err) {
      out.collection = field.collectionId
    }
  }
  if (typeof field.pattern === 'string' && field.pattern) out.pattern = field.pattern
  if (field.min !== undefined && field.min !== null && field.min !== 0 && field.min !== '') out.min = field.min
  if (field.max !== undefined && field.max !== null && field.max !== 0 && field.max !== '') out.max = field.max
  if (typeof field.maxSize === 'number' && field.maxSize) out.maxSize = field.maxSize
  return out
}

function describeCollection(app, collection) {
  const c = collectionJson(collection)
  return {
    name: c.name,
    type: c.type,
    listRule: c.listRule === undefined ? null : c.listRule,
    viewRule: c.viewRule === undefined ? null : c.viewRule,
    createRule: c.createRule === undefined ? null : c.createRule,
    updateRule: c.updateRule === undefined ? null : c.updateRule,
    deleteRule: c.deleteRule === undefined ? null : c.deleteRule,
    indexes: Array.isArray(c.indexes) ? c.indexes : [],
    fields: Array.isArray(c.fields) ? c.fields.map((f) => describeField(app, f)) : [],
  }
}

function listApps() {
  const apps = []
  for (const entry of $os.readDir(`${__hooks}/../pb_public`)) {
    if (!entry.isDir()) continue
    const name = entry.name()
    if (!/^[a-z0-9-]+$/.test(name)) continue
    const manifest = readManifest(name)
    if (!manifest || typeof manifest !== 'object') continue
    apps.push({
      name: str(manifest.name, name),
      title: str(manifest.title, ''),
      description: str(manifest.description, ''),
      icon: str(manifest.icon, ''),
      hidden: manifest.hidden === true,
      category: str(manifest.category, ''),
      tags: Array.isArray(manifest.tags) ? manifest.tags : [],
      mcp: !!(manifest.mcp && manifest.mcp.enabled === true),
      identityRequired: !!require(`${__hooks}/lib/config.js`).parseAccess(manifest),
    })
  }
  apps.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return { apps }
}

function describeApp(app, slug) {
  const manifest = readManifest(slug)
  if (!manifest) throw new Error(`app "${slug}" has no cubby.json`)
  const { tokenVar } = require(`${__hooks}/lib/mcp.js`)
  const prefix = `${slug.replace(/-/g, '_')}_`
  const collections = []
  for (const collection of app.findAllCollections()) {
    if (!collection || collection.system) continue
    const name = String(collection.name)
    if (name.startsWith(prefix)) collections.push(describeCollection(app, collection))
  }
  let mcpTools = []
  let mcpError
  if (manifest.mcp && manifest.mcp.enabled === true) {
    try {
      mcpTools = require(`${__hooks}/lib/mcp.js`).loadModule(`${__hooks}/apps/${slug}/mcp.js`).tools
    } catch (err) {
      mcpError = String(err && err.message ? err.message : err)
    }
  }
  const out = {
    app: slug,
    manifest,
    collections,
    mcpTools,
    mcpEndpoint: manifest.mcp && manifest.mcp.enabled === true ? `/_cubby/mcp/${slug}` : null,
    tokenVar: tokenVar(slug),
    tokenConfigured: !!$os.getenv(tokenVar(slug)),
    identityRequired: !!require(`${__hooks}/lib/config.js`).parseAccess(manifest),
    contentEndpoint: `/_cubby/content/${slug}`,
  }
  if (mcpError) out.mcpError = mcpError
  return out
}

function listCollections(app, prefix) {
  const collections = []
  for (const collection of app.findAllCollections()) {
    if (!collection || collection.system) continue
    const name = String(collection.name)
    if (name.startsWith('_')) continue
    if (prefix && !name.startsWith(prefix)) continue
    const c = collectionJson(collection)
    collections.push({
      name,
      type: c.type,
      fieldCount: Array.isArray(c.fields) ? c.fields.length : 0,
      listRule: c.listRule === undefined ? null : c.listRule,
      viewRule: c.viewRule === undefined ? null : c.viewRule,
    })
  }
  return { collections }
}

function queryRecords(app, args) {
  const collection = findReadableCollection(app, args.collection)
  const filter = typeof args.filter === 'string' ? args.filter : ''
  if (filter.length > MAX_FILTER) throw invalid(`filter must be at most ${MAX_FILTER} chars`)
  const sort = typeof args.sort === 'string' ? args.sort : ''
  if (sort && !SORT_RE.test(sort)) throw invalid('sort must look like "-created,id"')
  const page = Number.isInteger(args.page) && args.page >= 1 ? args.page : 1
  const perPage = Number.isInteger(args.perPage) ? Math.min(Math.max(args.perPage, 1), MAX_PER_PAGE) : 50
  const params = {}
  if (args.params !== undefined) {
    if (!args.params || typeof args.params !== 'object' || Array.isArray(args.params)) {
      throw invalid('params must be an object of scalar values')
    }
    for (const key of Object.keys(args.params)) {
      const value = args.params[key]
      if (!PARAM_KEY_RE.test(key)) throw invalid(`params key "${key}" must match ^[a-z_][a-z0-9_]*$`)
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
        throw invalid(`params.${key} must be a string, number, boolean or null`)
      }
      params[key] = value
    }
  }
  let rows
  try {
    rows = app.findRecordsByFilter(collection.name, filter, sort, perPage + 1, (page - 1) * perPage, params)
  } catch (err) {
    throw new Error(`query failed: ${err && err.message ? err.message : err}`)
  }
  const items = []
  for (let i = 0; i < rows.length && i < perPage; i++) items.push(rows[i].publicExport())
  return { collection: collection.name, items, page, perPage, hasMore: rows.length > perPage }
}

function getRecord(app, args) {
  const collection = findReadableCollection(app, args.collection)
  let record
  try {
    record = app.findRecordById(collection.name, args.id)
  } catch (err) {
    throw new Error(`record "${args.id}" not found in ${collection.name}`)
  }
  return { collection: collection.name, record: record.publicExport() }
}

function readApp(app, slug, route) {
  const out = require(`${__hooks}/lib/content.js`).renderContent(app, slug, route)
  if (out.code === 'bad_request') throw invalid(out.message)
  if (out.code) throw new Error(`${out.code}: ${out.message}`)
  return out.markdown
}

function call(name, args, ctx) {
  switch (name) {
    case 'list_apps':
      return listApps()
    case 'describe_app':
      return describeApp(ctx.app, args.app)
    case 'read_app':
      return readApp(ctx.app, args.app, typeof args.route === 'string' ? args.route : '')
    case 'list_collections':
      return listCollections(ctx.app, typeof args.prefix === 'string' ? args.prefix : '')
    case 'query_records':
      return queryRecords(ctx.app, args)
    case 'get_record':
      return getRecord(ctx.app, args)
    default:
      throw invalid(`unknown tool "${name}"`)
  }
}

module.exports = { mcp, tools, call }
