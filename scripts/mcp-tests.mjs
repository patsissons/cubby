// MCP protocol core tests. Pure Node, no server: loads pb_hooks/lib/mcp.js
// (a CommonJS module whose protocol core uses no JSVM globals) against a
// fake tool module and checks JSON-RPC shapes end to end. pb_hooks/package.json
// marks that tree CommonJS so createRequire can load it despite the root
// "type": "module" (PocketBase ignores the file).
//
//   node scripts/mcp-tests.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const lib = createRequire(import.meta.url)('../pb_hooks/lib/mcp.js')

let passed = 0
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`ok   ${name}`)
  } catch (err) {
    console.error(`FAIL ${name}`)
    console.error(err)
    process.exitCode = 1
  }
}

// --- fixtures ---

const fake = {
  tools: [
    { name: 'str', description: 'returns a string', inputSchema: { type: 'object' } },
    { name: 'obj', description: 'returns an object', inputSchema: { type: 'object' } },
    { name: 'passthrough', description: 'returns a content array', inputSchema: { type: 'object' } },
    { name: 'big', description: 'returns 250k chars', inputSchema: { type: 'object' } },
    { name: 'boom', description: 'throws an Error', inputSchema: { type: 'object' } },
    { name: 'params_bad', description: 'throws invalid_params', inputSchema: { type: 'object' } },
    { name: 'weird', description: 'throws a string', inputSchema: { type: 'object' } },
    { name: 'ctx_echo', description: 'returns ctx.slug', inputSchema: { type: 'object' } },
    {
      name: 'strict',
      description: 'validated arguments',
      inputSchema: {
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 10, pattern: '^[a-z]+$' },
          kind: { type: 'string', enum: ['a', 'b'] },
          count: { type: 'integer', minimum: 1, maximum: 5 },
          nested: {
            type: 'object',
            required: ['inner'],
            properties: { inner: { type: 'boolean' }, list: { type: 'array', items: { type: 'number' } } },
          },
        },
      },
    },
  ],
  call(name, args, ctx) {
    switch (name) {
      case 'str':
        return `hello ${args.who || 'world'}`
      case 'obj':
        return { a: 1, b: [2, 3] }
      case 'passthrough':
        return { content: [{ type: 'text', text: 'raw' }, { type: 'image', data: 'AA==', mimeType: 'image/png' }] }
      case 'big':
        return 'x'.repeat(250000)
      case 'boom':
        throw new Error('kaboom')
      case 'params_bad':
        throw { code: 'invalid_params', message: 'bad thing' }
      case 'weird':
        throw 'not an error object'
      case 'ctx_echo':
        return ctx.slug
      case 'strict':
        return 'ok'
      default:
        throw new Error(`unexpected ${name}`)
    }
  },
}

const describe = lib.describeServer({
  name: 'cubby-mcp:test',
  mcp: { enabled: true, description: 'Test server', instructions: 'Be nice.' },
})
const opts = { module: fake, describe, ctx: { slug: 'test' } }

function run(raw) {
  const { messages, batch } = lib.parseBody(typeof raw === 'string' ? raw : JSON.stringify(raw))
  return lib.dispatch(messages, batch, opts)
}
const req = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) })
const call = (id, name, args) => req(id, 'tools/call', { name, arguments: args })

// --- module validation ---

await test('validateModule accepts the fixture and rejects bad shapes', () => {
  assert.deepEqual(lib.validateModule(fake), [])
  assert.ok(lib.validateModule(null).length)
  assert.ok(lib.validateModule({ tools: 'nope', call() {} }).some((p) => p.includes('tools')))
  assert.ok(lib.validateModule({ tools: [], call: 1 }).some((p) => p.includes('call')))
  assert.ok(lib.validateModule({ tools: [{ name: 'Bad-Name' }], call() {} }).some((p) => p.includes('name')))
  assert.ok(lib.validateModule({ tools: [{ name: 'a' }, { name: 'a' }], call() {} }).some((p) => p.includes('duplicate')))
})

// --- parsing and envelopes ---

await test('parse error shape', () => {
  assert.throws(() => lib.parseBody('{'), (e) => e.code === -32700)
  const body = lib.errorResponse(null, -32700, 'parse error')
  assert.deepEqual(body, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } })
})

await test('-32600 on missing jsonrpc or method', () => {
  let out = run({ id: 1, method: 'ping' })
  assert.equal(out.status, 200)
  assert.equal(out.body.error.code, -32600)
  assert.equal(out.body.id, 1)
  out = run({ jsonrpc: '2.0', id: 2 })
  assert.equal(out.body.error.code, -32600)
  out = run('"just a string"')
  assert.equal(out.body.error.code, -32600)
  assert.equal(out.body.id, null)
})

await test('notification -> 202 with no body', () => {
  const out = run({ jsonrpc: '2.0', method: 'notifications/initialized' })
  assert.equal(out.status, 202)
  assert.equal(out.body, undefined)
  assert.equal(run({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } }).status, 202)
  // A request method without an id is still a notification: no response.
  assert.equal(run({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'boom' } }).status, 202)
})

await test('batch mixing a notification and ping returns one result', () => {
  const out = run([{ jsonrpc: '2.0', method: 'notifications/initialized' }, req(7, 'ping')])
  assert.equal(out.status, 200)
  assert.ok(Array.isArray(out.body))
  assert.equal(out.body.length, 1)
  assert.deepEqual(out.body[0], { jsonrpc: '2.0', id: 7, result: {} })
})

await test('batch of only notifications -> 202; empty and oversize batches -> -32600', () => {
  assert.equal(run([{ jsonrpc: '2.0', method: 'notifications/initialized' }]).status, 202)
  let out = run([])
  assert.equal(out.status, 200)
  assert.equal(out.body.error.code, -32600)
  out = run(Array.from({ length: lib.MAX_BATCH + 1 }, (_, i) => req(i, 'ping')))
  assert.equal(out.body.error.code, -32600)
  out = run(Array.from({ length: lib.MAX_BATCH }, (_, i) => req(i, 'ping')))
  assert.equal(out.body.length, lib.MAX_BATCH)
})

// --- handshakes ---

await test('initialize negotiates known, unknown and absent versions', () => {
  let out = run(req(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } }))
  assert.equal(out.body.result.protocolVersion, '2025-06-18')
  assert.deepEqual(out.body.result.capabilities, { tools: {} })
  assert.deepEqual(out.body.result.serverInfo, { name: 'cubby-mcp:test', version: '1', title: 'Test server' })
  assert.equal(out.body.result.instructions, 'Be nice.')
  out = run(req(1, 'initialize', { protocolVersion: '1999-01-01' }))
  assert.equal(out.body.result.protocolVersion, lib.SUPPORTED_VERSIONS[0])
  out = run(req(1, 'initialize'))
  assert.equal(out.body.result.protocolVersion, lib.SUPPORTED_VERSIONS[0])
})

await test('initialize omits instructions when the manifest has none', () => {
  const bare = lib.describeServer({ name: 'cubby-mcp', mcp: { enabled: true } })
  assert.equal('instructions' in bare.initialize('2025-11-25'), false)
  assert.equal('title' in bare.serverInfo, false)
  assert.equal('instructions' in bare.discover(), false)
})

await test('server/discover shape', () => {
  const out = run(req('d1', 'server/discover', { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }))
  const r = out.body.result
  assert.ok(r.supportedVersions.includes('2026-07-28'))
  for (const v of lib.SUPPORTED_VERSIONS) assert.ok(r.supportedVersions.includes(v))
  assert.deepEqual(r.capabilities, { tools: {} })
  assert.deepEqual(r._meta['io.modelcontextprotocol/serverInfo'], { name: 'cubby-mcp:test', version: '1', title: 'Test server' })
  assert.equal(r.instructions, 'Be nice.')
  assert.equal(out.body.id, 'd1')
})

await test('ping -> {} and tools/list returns the module tools', () => {
  assert.deepEqual(run(req(1, 'ping')).body.result, {})
  const out = run(req(2, 'tools/list', { cursor: 'ignored' }))
  assert.equal(out.body.result.tools.length, fake.tools.length)
  assert.equal(out.body.result.tools[0].name, 'str')
})

await test('-32601 for unsupported methods', () => {
  for (const method of ['resources/list', 'prompts/list', 'logging/setLevel', 'completion/complete', 'nope']) {
    const out = run(req(1, method))
    assert.equal(out.body.error.code, -32601, method)
  }
})

// --- tools/call ---

await test('unknown tool -> -32602', () => {
  const out = run(call(1, 'missing', {}))
  assert.equal(out.body.error.code, -32602)
  assert.ok(out.body.error.message.includes('missing'))
  assert.equal(run(req(1, 'tools/call', {})).body.error.code, -32602)
})

await test('-32602 from validateArgs: required, enum, additionalProperties, nested, bounds', () => {
  const bad = (args) => {
    const out = run(call(1, 'strict', args))
    assert.equal(out.body.error.code, -32602, JSON.stringify(args))
    return out.body.error.message
  }
  assert.ok(bad({}).includes('name is required'))
  assert.ok(bad({ name: 'abc', kind: 'c' }).includes('kind must be one of'))
  assert.ok(bad({ name: 'abc', extra: 1 }).includes('extra is not allowed'))
  assert.ok(bad({ name: 'abc', nested: {} }).includes('nested.inner is required'))
  assert.ok(bad({ name: 'abc', nested: { inner: 'no' } }).includes('nested.inner must be boolean'))
  assert.ok(bad({ name: 'abc', nested: { inner: true, list: [1, 'x'] } }).includes('list[1] must be number'))
  assert.ok(bad({ name: 'abc', count: 9 }).includes('count must be <= 5'))
  assert.ok(bad({ name: 'abc', count: 1.5 }).includes('count must be integer'))
  assert.ok(bad({ name: 'ABC' }).includes('must match'))
  assert.ok(bad({ name: '' }).includes('at least 1'))
  assert.ok(bad({ name: 'abcdefghijklmnop' }).includes('at most 10'))
  // several problems are joined
  assert.ok(bad({ kind: 'z' }).includes('; '))
  assert.equal(run(call(1, 'strict', 'not-an-object')).body.error.code, -32602)
  // and a valid call goes through
  assert.equal(run(call(1, 'strict', { name: 'abc', kind: 'a', count: 2, nested: { inner: true, list: [1] } })).body.result.content[0].text, 'ok')
})

await test('validateArgs ignores unsupported keywords and missing schemas', () => {
  assert.deepEqual(lib.validateArgs({ type: 'object', oneOf: [], $ref: '#/x' }, { any: 1 }), [])
  assert.deepEqual(lib.validateArgs(undefined, { any: 1 }), [])
  assert.deepEqual(lib.validateArgs({ type: ['string', 'null'] }, null), [])
})

await test('thrown Error -> isError result, not a protocol error', () => {
  const out = run(call(1, 'boom', {}))
  assert.equal(out.body.error, undefined)
  assert.equal(out.body.result.isError, true)
  assert.deepEqual(out.body.result.content, [{ type: 'text', text: 'kaboom' }])
})

await test('thrown { code: invalid_params } -> -32602; other throws -> -32603', () => {
  assert.equal(run(call(1, 'params_bad', {})).body.error.code, -32602)
  assert.equal(run(call(1, 'params_bad', {})).body.error.message, 'bad thing')
  const out = run(call(1, 'weird', {}))
  assert.equal(out.body.error.code, -32603)
  assert.ok(out.body.error.message.includes('not an error object'))
})

await test('result shaping: string, object, passthrough', () => {
  let r = run(call(1, 'str', { who: 'cubby' })).body.result
  assert.deepEqual(r, { content: [{ type: 'text', text: 'hello cubby' }] })
  r = run(call(1, 'obj', {})).body.result
  assert.deepEqual(r.structuredContent, { a: 1, b: [2, 3] })
  assert.equal(r.content[0].type, 'text')
  assert.deepEqual(JSON.parse(r.content[0].text), { a: 1, b: [2, 3] })
  r = run(call(1, 'passthrough', {})).body.result
  assert.equal(r.content.length, 2)
  assert.equal(r.content[1].type, 'image')
  assert.equal(r.structuredContent, undefined)
})

await test('ctx is passed through to call()', () => {
  assert.equal(run(call(1, 'ctx_echo', {})).body.result.content[0].text, 'test')
})

await test('long text results are truncated', () => {
  const text = run(call(1, 'big', {})).body.result.content[0].text
  assert.ok(text.endsWith('[truncated]'))
  assert.ok(text.length < 250000)
  assert.ok(text.length >= lib.MAX_TEXT)
  assert.deepEqual(lib.shapeResult('short'), { content: [{ type: 'text', text: 'short' }] })
})

// --- token var naming (pure) ---

await test('tokenVar derives the env var name from the slug', () => {
  assert.equal(lib.tokenVar(''), 'CUBBY_MCP_TOKEN')
  assert.equal(lib.tokenVar(undefined), 'CUBBY_MCP_TOKEN')
  assert.equal(lib.tokenVar('hello'), 'HELLO_MCP_TOKEN')
  assert.equal(lib.tokenVar('my-app'), 'MY_APP_MCP_TOKEN')
})

console.log(passed === 0 ? 'no tests ran' : process.exitCode ? 'MCP TESTS FAILED' : `all ${passed} tests passed`)
process.exit(process.exitCode || 0)
