// MCP (Model Context Protocol) server core for the /_cubby/mcp endpoints:
// JSON-RPC parsing, method dispatch, tool argument validation, result shaping.
// Runs in the PocketBase JSVM (goja): synchronous, CommonJS, no Node APIs.
//
// The protocol core (parseBody, dispatch, validateArgs, shapeResult,
// describeServer, validateModule) touches no JSVM globals, so
// scripts/mcp-tests.mjs loads this file in plain Node. The helpers at the
// bottom (readBearer, checkToken, loadAppMcp, loadModule, serve) do use JSVM
// globals and are only called from pb_hooks/mcp.pb.js, whose handlers are
// one-liners: the JSVM re-evaluates each handler in an isolated context, so
// a handler cannot call a sibling top-level function, only what it requires.
//
// Both endpoints are stateless Streamable HTTP: one POST per message (or
// legacy batch), plain application/json responses, no SSE, no sessions.
// Two handshakes are answered from one server description: the legacy
// `initialize` (protocol revisions 2025-03-26 .. 2025-11-25, what Claude Code
// speaks today) and the 2026-07-28 `server/discover`.

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26']
const DISCOVER_VERSIONS = ['2026-07-28'].concat(SUPPORTED_VERSIONS)
const BODY_LIMIT = 1048576
// 2026-07-28 caching hints on server/discover and tools/list: tool modules
// only change on restart, and the endpoint is token-gated, so private scope.
const CACHE_TTL_MS = 300000
const CACHE_SCOPE = 'private'
const MAX_BATCH = 20
const MAX_TEXT = 200000
const TOOL_NAME_RE = /^[a-z][a-z0-9_]{0,63}$/

const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
}

function errorResponse(id, code, message, data) {
  const error = { code, message }
  if (data !== undefined) error.data = data
  return { jsonrpc: '2.0', id: id === undefined ? null : id, error }
}

/** Thrown inside method handlers; dispatch turns it into a JSON-RPC error. */
function rpcError(code, message, data) {
  return { rpc: true, code, message, data }
}

function clip(text, max) {
  const s = String(text)
  return s.length > max ? s.slice(0, max) : s
}

/**
 * Parse a raw request body. Returns { messages, batch }. Throws
 * { code: -32700 } when the body is not JSON at all; structural problems
 * (empty batch, oversize batch, non-object messages) are reported per
 * message by dispatch so they travel as HTTP 200 JSON-RPC errors.
 */
function parseBody(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw { code: ERR.PARSE, message: 'parse error' }
  }
  if (Array.isArray(parsed)) return { messages: parsed, batch: true }
  return { messages: [parsed], batch: false }
}

/**
 * Check a tool module's shape. Returns a list of problems (empty = valid).
 * @param {any} module
 */
function validateModule(module) {
  const problems = []
  if (!module || typeof module !== 'object') return ['module.exports must be an object']
  if (!Array.isArray(module.tools)) problems.push('tools must be an array')
  else {
    const seen = {}
    module.tools.forEach((tool, i) => {
      if (!tool || typeof tool !== 'object') return problems.push(`tools[${i}] must be an object`)
      if (typeof tool.name !== 'string' || !TOOL_NAME_RE.test(tool.name)) {
        return problems.push(`tools[${i}].name must match ${TOOL_NAME_RE}`)
      }
      if (seen[tool.name]) problems.push(`duplicate tool name "${tool.name}"`)
      seen[tool.name] = true
      if (tool.inputSchema !== undefined && (!tool.inputSchema || typeof tool.inputSchema !== 'object')) {
        problems.push(`tools[${i}].inputSchema must be an object`)
      }
    })
  }
  if (typeof module.call !== 'function') problems.push('call must be a function')
  return problems
}

/**
 * One description feeds both handshakes.
 * @param {{ name: string, mcp: { description?: string, instructions?: string } }} opts
 */
function describeServer(opts) {
  const mcp = (opts && opts.mcp) || {}
  const serverInfo = { name: opts.name, version: '1' }
  if (typeof mcp.description === 'string' && mcp.description) serverInfo.title = mcp.description
  const instructions = typeof mcp.instructions === 'string' && mcp.instructions ? mcp.instructions : ''
  const capabilities = { tools: {} }
  return {
    serverInfo,
    capabilities,
    instructions,
    initialize(requested) {
      const protocolVersion = SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0]
      const result = { protocolVersion, capabilities, serverInfo }
      if (instructions) result.instructions = instructions
      return result
    },
    discover() {
      const result = {
        resultType: 'complete',
        supportedVersions: DISCOVER_VERSIONS.slice(),
        capabilities,
        _meta: { 'io.modelcontextprotocol/serverInfo': serverInfo },
        ttlMs: CACHE_TTL_MS,
        cacheScope: CACHE_SCOPE,
      }
      if (instructions) result.instructions = instructions
      return result
    },
  }
}

function typeOf(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

/**
 * Lightweight JSON-schema subset validator. Returns a list of problems.
 * Supported: type, required, properties, additionalProperties:false, enum,
 * minimum/maximum, minLength/maxLength, pattern, items. Unknown keywords
 * are ignored.
 */
function validateArgs(schema, value, path) {
  const problems = []
  if (!schema || typeof schema !== 'object') return problems
  const label = path || 'arguments'
  const type = typeOf(value)

  if (schema.type !== undefined) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type]
    const ok = allowed.some((t) => (t === 'integer' ? type === 'number' && Number.isInteger(value) : t === type))
    if (!ok) {
      problems.push(`${label} must be ${allowed.join(' or ')}`)
      return problems
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((v) => v === value)) {
    problems.push(`${label} must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`)
  }
  if (type === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) problems.push(`${label} must be >= ${schema.minimum}`)
    if (typeof schema.maximum === 'number' && value > schema.maximum) problems.push(`${label} must be <= ${schema.maximum}`)
  }
  if (type === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      problems.push(`${label} must be at least ${schema.minLength} chars`)
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      problems.push(`${label} must be at most ${schema.maxLength} chars`)
    }
    if (typeof schema.pattern === 'string') {
      let ok = true
      try {
        ok = new RegExp(schema.pattern).test(value)
      } catch (err) {
        ok = true
      }
      if (!ok) problems.push(`${label} must match ${schema.pattern}`)
    }
  }
  if (type === 'object') {
    const props = schema.properties && typeof schema.properties === 'object' ? schema.properties : {}
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (value[key] === undefined) problems.push(`${label}.${key} is required`)
      }
    }
    for (const key of Object.keys(value)) {
      if (props[key] !== undefined) {
        problems.push(...validateArgs(props[key], value[key], `${label}.${key}`))
      } else if (schema.additionalProperties === false) {
        problems.push(`${label}.${key} is not allowed`)
      }
    }
  }
  if (type === 'array' && schema.items && typeof schema.items === 'object') {
    value.forEach((item, i) => problems.push(...validateArgs(schema.items, item, `${label}[${i}]`)))
  }
  return problems
}

/**
 * Shape whatever a tool's call() returned into a CallToolResult.
 * string -> text; { content: [...] } -> passthrough; object -> JSON text +
 * structuredContent. Text items longer than MAX_TEXT are truncated.
 */
function shapeResult(ret) {
  let result
  if (typeof ret === 'string') {
    result = { content: [{ type: 'text', text: ret }] }
  } else if (ret && typeof ret === 'object' && Array.isArray(ret.content)) {
    result = ret
  } else if (ret && typeof ret === 'object') {
    result = { content: [{ type: 'text', text: JSON.stringify(ret, null, 2) }], structuredContent: ret }
  } else {
    result = { content: [{ type: 'text', text: ret === undefined || ret === null ? '' : String(ret) }] }
  }
  for (const item of result.content) {
    if (item && item.type === 'text' && typeof item.text === 'string' && item.text.length > MAX_TEXT) {
      item.text = `${item.text.slice(0, MAX_TEXT)}\n[truncated]`
    }
  }
  return result
}

function callTool(module, tool, args, ctx) {
  let ret
  try {
    ret = module.call(tool.name, args, ctx)
  } catch (err) {
    if (err && typeof err === 'object' && !(err instanceof Error) && err.code === 'invalid_params') {
      throw rpcError(ERR.INVALID_PARAMS, String(err.message || 'invalid params'))
    }
    // Error instances (including goja-wrapped Go errors, which carry a
    // message) are tool failures the model can act on, not protocol errors.
    if (err instanceof Error || (err && typeof err === 'object' && typeof err.message === 'string')) {
      return { content: [{ type: 'text', text: String(err.message || err) }], isError: true }
    }
    throw rpcError(ERR.INTERNAL, clip(err && err.message ? err.message : String(err), 300))
  }
  return shapeResult(ret)
}

function handleMethod(method, params, opts) {
  const { module, describe, ctx } = opts
  switch (method) {
    case 'initialize':
      return describe.initialize(params.protocolVersion)
    case 'server/discover':
      return describe.discover()
    case 'ping':
      return {}
    case 'tools/list':
      return { tools: module.tools }
    case 'tools/call': {
      const name = params.name
      const tool = typeof name === 'string' ? module.tools.find((t) => t.name === name) : undefined
      if (!tool) throw rpcError(ERR.INVALID_PARAMS, `unknown tool "${String(name)}"`)
      const args = params.arguments === undefined ? {} : params.arguments
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw rpcError(ERR.INVALID_PARAMS, 'arguments must be an object')
      }
      const problems = validateArgs(tool.inputSchema, args)
      if (problems.length) throw rpcError(ERR.INVALID_PARAMS, problems.join('; '))
      return callTool(module, tool, args, ctx)
    }
    default:
      throw rpcError(ERR.METHOD_NOT_FOUND, `method not found: ${method}`)
  }
}

/**
 * A request from a modern (2026-07-28+) client carries its protocol version
 * in params._meta. That revision's results are MRTR-shaped and MUST carry
 * resultType ("complete" here: nothing asks the client for more input).
 * Legacy initialize-era clients get the plain shapes they expect.
 */
function isModernRequest(params) {
  const meta = params && params._meta
  const version = meta && typeof meta === 'object' ? meta['io.modelcontextprotocol/protocolVersion'] : undefined
  return typeof version === 'string' && !SUPPORTED_VERSIONS.includes(version)
}

/** Handle one message; returns a response object, or undefined for notifications. */
function handleMessage(msg, opts) {
  const isObject = msg && typeof msg === 'object' && !Array.isArray(msg)
  if (!isObject || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return errorResponse(isObject && msg.id !== undefined ? msg.id : null, ERR.INVALID_REQUEST, 'invalid request')
  }
  // No id: a notification. notifications/initialized, notifications/cancelled
  // and anything else under notifications/* are accepted silently; a request
  // method without an id gets no response either (JSON-RPC 2.0).
  if (msg.id === undefined) return undefined
  const params = msg.params && typeof msg.params === 'object' && !Array.isArray(msg.params) ? msg.params : {}
  try {
    const result = handleMethod(msg.method, params, opts)
    if (isModernRequest(params) && result && typeof result === 'object') {
      if (result.resultType === undefined) result.resultType = 'complete'
      if (msg.method === 'tools/list') {
        result.ttlMs = CACHE_TTL_MS
        result.cacheScope = CACHE_SCOPE
      }
    }
    return { jsonrpc: '2.0', id: msg.id, result }
  } catch (err) {
    if (err && err.rpc) return errorResponse(msg.id, err.code, err.message, err.data)
    return errorResponse(msg.id, ERR.INTERNAL, clip(err && err.message ? err.message : String(err), 300))
  }
}

/**
 * Dispatch parsed messages. Returns { status, body, methods, errors }:
 * status 202 with no body when every message was a notification, else 200
 * with a single response or an array of responses for a batch.
 *
 * @param {any[]} messages
 * @param {boolean} batch
 * @param {{ module: any, describe: any, ctx: any }} opts
 */
function dispatch(messages, batch, opts) {
  const methods = messages.map((m) => (m && typeof m === 'object' && typeof m.method === 'string' ? m.method : '?'))
  if (batch && messages.length === 0) {
    return { status: 200, body: errorResponse(null, ERR.INVALID_REQUEST, 'empty batch'), methods, errors: 1 }
  }
  if (batch && messages.length > MAX_BATCH) {
    return {
      status: 200,
      body: errorResponse(null, ERR.INVALID_REQUEST, `batch exceeds ${MAX_BATCH} messages`),
      methods,
      errors: 1,
    }
  }
  const responses = []
  for (const msg of messages) {
    const res = handleMessage(msg, opts)
    if (res !== undefined) responses.push(res)
  }
  const errors = responses.filter((r) => r.error).length
  if (responses.length === 0) return { status: 202, body: undefined, methods, errors }
  return { status: 200, body: batch ? responses : responses[0], methods, errors }
}

// --- JSVM helpers (globals used only inside these bodies) ---

/** Env var holding the bearer token: CUBBY_MCP_TOKEN, or <SLUG>_MCP_TOKEN. */
function tokenVar(slug) {
  return slug ? `${String(slug).toUpperCase().replace(/-/g, '_')}_MCP_TOKEN` : 'CUBBY_MCP_TOKEN'
}

function readBearer(e) {
  const header = e.request.header.get('Authorization') || ''
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match ? match[1] : ''
}

/** Constant-time compare; hashing first so the inputs have equal length. */
function checkToken(given, expected) {
  if (!given || !expected) return false
  return $security.equal($security.sha256(given), $security.sha256(expected))
}

/**
 * Load an app's mcp declaration from its committed manifest. Returns null
 * unless the manifest has "mcp": { "enabled": true, ... }.
 *
 *   "mcp": {
 *     "enabled": true,
 *     "description": "short serverInfo.title",
 *     "instructions": "optional; returned verbatim by the handshake"
 *   }
 */
function loadAppMcp(slug) {
  let manifest = {}
  try {
    manifest = JSON.parse(toString($os.readFile(`${__hooks}/../pb_public/${slug}/cubby.json`)))
  } catch (err) {
    return null
  }
  const mcp = manifest.mcp
  if (!mcp || typeof mcp !== 'object' || mcp.enabled !== true) return null
  const str = (value, fallback) => (typeof value === 'string' && value ? value : fallback)
  return {
    manifest,
    mcp: {
      enabled: true,
      description: str(mcp.description, ''),
      instructions: str(mcp.instructions, ''),
    },
  }
}

/** require() a tool module and validate its shape; throws { code: 'mcp_module_invalid' }. */
function loadModule(file) {
  let module
  try {
    module = require(file)
  } catch (err) {
    throw { code: 'mcp_module_invalid', status: 500, message: `${file}: ${err && err.message ? err.message : err}` }
  }
  const problems = validateModule(module)
  if (problems.length) {
    throw { code: 'mcp_module_invalid', status: 500, message: `${file}: ${problems.join('; ')}` }
  }
  return module
}

/** GET/DELETE on an MCP endpoint: no SSE stream, no sessions to end. */
function methodNotAllowed(e) {
  e.response.header().set('Allow', 'POST')
  e.response.header().set('Cache-Control', 'no-store')
  return e.json(405, { code: 'method_not_allowed', message: 'MCP endpoints accept POST only' })
}

/**
 * The whole request flow for both endpoints; `slug` is '' for the platform
 * endpoint. Every early exit is a plain { code, message } JSON error; only
 * parse failures answer with a JSON-RPC error envelope (HTTP 400).
 * Everything dispatched is HTTP 200, or 202 for notification-only requests.
 * The token is checked before the body is parsed, and a 401 carries no
 * WWW-Authenticate so MCP clients never start OAuth discovery.
 */
function serve(e, slug) {
  const started = Date.now()
  const endpoint = slug ? `/_cubby/mcp/${slug}` : '/_cubby/mcp'
  e.response.header().set('Cache-Control', 'no-store')

  const fail = (status, code, message) => {
    console.log(`[mcp] ${endpoint} - ${Date.now() - started}ms err:${code}`)
    return e.json(status, { code, message })
  }

  let manifest = null
  let mcp = null
  if (slug) {
    if (!/^[a-z0-9-]{1,100}$/.test(slug)) return fail(400, 'bad_request', 'invalid app slug')
    const loaded = loadAppMcp(slug)
    if (!loaded) return fail(404, 'not_found', `app "${slug}" does not declare mcp`)
    manifest = loaded.manifest
    mcp = loaded.mcp
  }

  const varName = tokenVar(slug)
  const expected = $os.getenv(varName)
  if (!expected) return fail(503, 'not_configured', `${varName} is not set`)
  if (!checkToken(readBearer(e), expected)) return fail(401, 'unauthorized', 'bearer token missing or invalid')

  // Raw body, not requestInfo().body: JSON-RPC batches are arrays.
  let raw = ''
  try {
    raw = toString(e.request.body, BODY_LIMIT)
  } catch (err) {
    raw = ''
  }
  let parsed
  try {
    parsed = parseBody(raw)
  } catch (err) {
    console.log(`[mcp] ${endpoint} - ${Date.now() - started}ms err:parse`)
    return e.json(400, errorResponse(null, ERR.PARSE, 'parse error'))
  }

  const file = slug ? `${__hooks}/apps/${slug}/mcp.js` : `${__hooks}/lib/mcp-platform-tools.js`
  let module
  try {
    module = loadModule(file)
  } catch (err) {
    console.log(`[mcp] ${endpoint} - ${Date.now() - started}ms err:mcp_module_invalid ${err.message}`)
    return e.json(500, { code: 'mcp_module_invalid', message: err.message })
  }
  if (!mcp) mcp = module.mcp || { enabled: true, description: 'cubby platform explorer', instructions: '' }

  const tag = slug || 'platform'
  const ctx = {
    app: e.app,
    slug,
    manifest,
    mcp,
    request: e.request,
    log: (msg) => console.log(`[mcp:${tag}] ${msg}`),
  }
  const describe = describeServer({ name: slug ? `cubby-mcp:${slug}` : 'cubby-mcp', mcp })

  let out
  try {
    out = dispatch(parsed.messages, parsed.batch, { module, describe, ctx })
  } catch (err) {
    console.log(`[mcp] ${endpoint} - ${Date.now() - started}ms err:internal ${err && err.message ? err.message : err}`)
    return e.json(500, { code: 'mcp_internal', message: 'dispatch failed' })
  }

  // One line per request; never the token, arguments, or results.
  console.log(
    `[mcp] ${endpoint} ${out.methods.join(',') || '-'} ${Date.now() - started}ms ${out.errors ? `err:${out.errors}` : 'ok'}`
  )
  if (out.status === 202) return e.noContent(202)
  return e.json(200, out.body)
}

module.exports = {
  SUPPORTED_VERSIONS,
  DISCOVER_VERSIONS,
  BODY_LIMIT,
  MAX_BATCH,
  MAX_TEXT,
  TOOL_NAME_RE,
  ERR,
  errorResponse,
  parseBody,
  validateModule,
  describeServer,
  validateArgs,
  shapeResult,
  dispatch,
  tokenVar,
  readBearer,
  checkToken,
  loadAppMcp,
  loadModule,
  methodNotAllowed,
  serve,
}
