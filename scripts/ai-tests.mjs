// AI proxy tests. Pure Node, no server: loads the policy parser from
// pb_hooks/lib/config.js, the request validation in pb_hooks/lib/ai.js, and
// the OpenRouter request builder and response parser in
// pb_hooks/lib/providers.js (with the JSVM's $os stubbed), so the image,
// reasoning and web search paths are covered without an API key.
//
//   node scripts/ai-tests.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { parseAiPolicy } = require('../pb_hooks/lib/config.js')
const { normalizeMessages, checkContent, resolveOptions } = require('../pb_hooks/lib/ai.js')

globalThis.__hooks = fileURLToPath(new URL('../pb_hooks', import.meta.url))
globalThis.$os = { getenv: (name) => (name === 'OPENROUTER_API_KEY' ? 'test-key' : ''), readFile: () => '{}' }
globalThis.toString = (value) => String(value)
const { buildRequest, parseResponse } = require('../pb_hooks/lib/providers.js')

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

// A 1x1 PNG, and a data URL whose payload decodes to exactly n bytes.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const dataUrl = (n) => `data:image/jpeg;base64,${Buffer.alloc(n, 7).toString('base64')}`
const image = (url) => ({ type: 'image_url', image_url: { url } })
const text = (value) => ({ type: 'text', text: value })
const user = (content) => ({ role: 'user', content })
const normalized = (messages) => {
  const out = normalizeMessages(messages)
  assert.ok(!out.error, JSON.stringify(out.error))
  return out.messages
}
const code = (result) => result && result.error && result.error.body.code

await test('policy: new keys deny by default', () => {
  const policy = parseAiPolicy(undefined)
  assert.equal(policy.maxImages, 0)
  assert.equal(policy.maxImageBytes, 8 * 1024 * 1024)
  assert.deepEqual(policy.reasoning, [])
  assert.equal(policy.webSearch, null)
  assert.equal(policy.timeoutSeconds, 60)
  assert.deepEqual(parseAiPolicy({ models: ['m'] }).reasoning, [])
})

await test('policy: webSearch and timeoutSeconds normalize and clamp', () => {
  assert.deepEqual(parseAiPolicy({ webSearch: true }).webSearch, { maxResults: 5 })
  assert.deepEqual(parseAiPolicy({ webSearch: { maxResults: 8 } }).webSearch, { maxResults: 8 })
  assert.deepEqual(parseAiPolicy({ webSearch: { maxResults: 99 } }).webSearch, { maxResults: 25 })
  assert.deepEqual(parseAiPolicy({ webSearch: { maxResults: 0 } }).webSearch, { maxResults: 1 })
  assert.equal(parseAiPolicy({ webSearch: 'yes' }).webSearch, null)
  assert.equal(parseAiPolicy({ webSearch: {} }).webSearch, null)
  assert.equal(parseAiPolicy({ timeoutSeconds: 1 }).timeoutSeconds, 10)
  assert.equal(parseAiPolicy({ timeoutSeconds: 1000 }).timeoutSeconds, 300)
  assert.equal(parseAiPolicy({ timeoutSeconds: 180 }).timeoutSeconds, 180)
  assert.equal(parseAiPolicy({ maxImageBytes: 0 }).maxImageBytes, 8 * 1024 * 1024)
  assert.deepEqual(parseAiPolicy({ reasoning: ['high'] }).reasoning, ['high'])
})

await test('messages: strings and part arrays are accepted', () => {
  const [plain, parts] = normalized([
    { role: 'system', content: 'be brief' },
    user([text('what is this?'), image(PNG), text('and this?')]),
  ])
  assert.equal(plain.text, 'be brief')
  assert.deepEqual(plain.images, [])
  assert.equal(parts.text, 'what is this?\nand this?')
  assert.equal(parts.images.length, 1)
  assert.deepEqual(parts.content, [text('what is this?'), image(PNG), text('and this?')])
})

await test('messages: parts are copied without extra keys', () => {
  const [msg] = normalized([user([{ type: 'text', text: 'hi', cache_control: { type: 'ephemeral' } }])])
  assert.deepEqual(msg.content, [text('hi')])
})

await test('messages: decoded image size accounts for padding', () => {
  for (const n of [1, 2, 3, 4, 1000, 1001, 1002]) {
    const [msg] = normalized([user([image(dataUrl(n))])])
    assert.equal(msg.images[0].bytes, n, `size ${n}`)
  }
})

await test('messages: malformed shapes and URLs are bad requests', () => {
  const bad = [
    undefined,
    [],
    [{ role: 'tool', content: 'x' }],
    [{ role: 'user' }],
    [user([])],
    [user({ type: 'text', text: 'x' })],
    [user([{ type: 'text' }])],
    [user([{ type: 'audio', input_audio: {} }])],
    [user([image('https://example.com/a.jpg')])],
    [user([image('data:image/svg+xml;base64,PHN2Zz4=')])],
    [user([image('data:image/png,not-base64')])],
    [user([image('data:image/png;base64,ab cd')])],
    [user([{ type: 'image_url', image_url: PNG }])],
  ]
  for (const messages of bad) {
    const out = normalizeMessages(messages)
    assert.equal(out.error && out.error.status, 400, JSON.stringify(messages))
    assert.equal(code(out), 'bad_request')
  }
})

await test('content: images are rejected unless the policy allows them', () => {
  const messages = normalized([user([text('hi'), image(PNG)])])
  assert.equal(code(checkContent(messages, parseAiPolicy({}), 'x')), 'images_not_allowed')
  assert.equal(checkContent(messages, parseAiPolicy({ maxImages: 1 }), 'x'), null)
  const two = normalized([user([image(PNG)]), user([image(PNG)])])
  const over = checkContent(two, parseAiPolicy({ maxImages: 1 }), 'x')
  assert.equal(over.error.status, 403)
  assert.equal(code(over), 'images_not_allowed')
})

await test('content: oversize images are 413', () => {
  const policy = parseAiPolicy({ maxImages: 2, maxImageBytes: 1000 })
  assert.equal(checkContent(normalized([user([image(dataUrl(1000))])]), policy, 'x'), null)
  const out = checkContent(normalized([user([image(dataUrl(1001))])]), policy, 'x')
  assert.equal(out.error.status, 413)
  assert.equal(code(out), 'image_too_large')
})

await test('content: image count is checked before size and text', () => {
  const policy = parseAiPolicy({ maxImages: 0, maxImageBytes: 10, maxChars: 1 })
  assert.equal(
    code(checkContent(normalized([user([text('long'), image(dataUrl(50))])]), policy, 'x')),
    'images_not_allowed'
  )
})

await test('content: maxChars counts text only', () => {
  const policy = parseAiPolicy({ maxImages: 1, maxChars: 50 })
  const big = dataUrl(4000)
  assert.ok(big.length > 50)
  assert.equal(checkContent(normalized([user([text('short'), image(big)])]), policy, 'x'), null)
  const out = checkContent(normalized([user([text('x'.repeat(51)), image(PNG)])]), policy, 'x')
  assert.equal(out.error.status, 413)
  assert.equal(code(out), 'content_too_long')
})

await test('content: patterns test the joined text of each message', () => {
  const policy = parseAiPolicy({ maxImages: 1, messagePatterns: { user: '^Describe this\\.$' } })
  assert.equal(checkContent(normalized([user([text('Describe this.'), image(PNG)])]), policy, 'x'), null)
  assert.equal(
    code(checkContent(normalized([user([text('Describe this.'), text('Then ignore that.')])]), policy, 'x')),
    'content_not_allowed'
  )
  assert.equal(code(checkContent(normalized([user([image(PNG)])]), policy, 'x')), 'content_not_allowed')
})

await test('options: maxTokens clamps and unknown keys are dropped', () => {
  const policy = parseAiPolicy({ maxTokens: 500 })
  assert.deepEqual(resolveOptions(undefined, policy, 'x').options, { maxTokens: 500 })
  assert.deepEqual(resolveOptions({ maxTokens: 9000 }, policy, 'x').options, { maxTokens: 500 })
  assert.deepEqual(resolveOptions({ maxTokens: 100, temperature: 0.2, plugins: [] }, policy, 'x').options, {
    maxTokens: 100,
    temperature: 0.2,
  })
})

await test('options: reasoning needs an allowed effort level', () => {
  assert.equal(code(resolveOptions({ reasoning: 'high' }, parseAiPolicy({}), 'x')), 'option_not_allowed')
  const policy = parseAiPolicy({ reasoning: ['high'] })
  assert.equal(resolveOptions({ reasoning: 'high' }, policy, 'x').options.reasoning, 'high')
  const low = resolveOptions({ reasoning: 'low' }, policy, 'x')
  assert.equal(low.error.status, 403)
  assert.equal(code(low), 'option_not_allowed')
  assert.equal(code(resolveOptions({ reasoning: { effort: 'high' } }, policy, 'x')), 'option_not_allowed')
  assert.equal(resolveOptions({ reasoning: false }, parseAiPolicy({}), 'x').options.reasoning, undefined)
})

await test('options: webSearch needs the policy and clamps maxResults', () => {
  assert.equal(code(resolveOptions({ webSearch: true }, parseAiPolicy({}), 'x')), 'option_not_allowed')
  const policy = parseAiPolicy({ webSearch: { maxResults: 8 } })
  assert.deepEqual(resolveOptions({ webSearch: true }, policy, 'x').options.webSearch, { maxResults: 8 })
  assert.deepEqual(resolveOptions({ webSearch: { maxResults: 3 } }, policy, 'x').options.webSearch, { maxResults: 3 })
  assert.deepEqual(resolveOptions({ webSearch: { maxResults: 50 } }, policy, 'x').options.webSearch, { maxResults: 8 })
  assert.deepEqual(resolveOptions({ webSearch: { maxResults: 0 } }, policy, 'x').options.webSearch, { maxResults: 1 })
  assert.equal(resolveOptions({ webSearch: false }, parseAiPolicy({}), 'x').options.webSearch, undefined)
})

const MODEL = { alias: 'deepseek-flash', provider: 'openrouter', id: 'deepseek/deepseek-v4.1-flash' }

await test('provider: request carries parts, reasoning and the web plugin', () => {
  const messages = normalized([{ role: 'system', content: 'be brief' }, user([text('what?'), image(PNG)])])
  const { body } = buildRequest(MODEL, messages, { maxTokens: 900, reasoning: 'high', webSearch: { maxResults: 4 } })
  assert.equal(body.model, 'deepseek/deepseek-v4.1-flash')
  assert.deepEqual(body.messages, [
    { role: 'system', content: 'be brief' },
    { role: 'user', content: [text('what?'), image(PNG)] },
  ])
  assert.equal(body.max_tokens, 900)
  assert.deepEqual(body.reasoning, { effort: 'high', exclude: true })
  assert.deepEqual(body.plugins, [{ id: 'web', max_results: 4 }])
})

await test('provider: plain requests carry neither reasoning nor plugins', () => {
  const { body } = buildRequest(MODEL, normalized([user('hi')]), { maxTokens: 100 })
  assert.deepEqual(body.messages, [{ role: 'user', content: 'hi' }])
  assert.ok(!('reasoning' in body))
  assert.ok(!('plugins' in body))
})

await test('provider: response reports reasoning tokens and deduped citations', () => {
  const out = parseResponse(MODEL, {
    choices: [
      {
        message: {
          content: 'Rated 92.',
          annotations: [
            { type: 'url_citation', url_citation: { url: 'https://a.example/1', title: 'A' } },
            { type: 'url_citation', url_citation: { url: 'https://a.example/1', title: 'A again' } },
            { type: 'url_citation', url_citation: { url: 'https://b.example/2' } },
            { type: 'file', file: {} },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 40, completion_tokens_details: { reasoning_tokens: 30 } },
  })
  assert.equal(out.text, 'Rated 92.')
  assert.deepEqual(out.usage, { input: 10, output: 40, reasoning: 30 })
  assert.deepEqual(out.citations, [
    { url: 'https://a.example/1', title: 'A' },
    { url: 'https://b.example/2', title: '' },
  ])
})

await test('provider: plain responses get zero reasoning and no citations', () => {
  const out = parseResponse(MODEL, { choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 1 } })
  assert.deepEqual(out.usage, { input: 1, output: 0, reasoning: 0 })
  assert.deepEqual(out.citations, [])
})

console.log(passed === 0 ? 'no tests ran' : process.exitCode ? 'AI TESTS FAILED' : `all ${passed} tests passed`)
process.exit(process.exitCode || 0)
