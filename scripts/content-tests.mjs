// Agent-readable content tests. Pure Node, no server: loads the pure core of
// pb_hooks/lib/content.js (HTML -> markdown, snapshot assembly) and
// the visibility helpers from pb_hooks/lib/config.js, drives publicRecords against a
// fake JSVM app, then runs the real app pages through the converter.
//
//   node scripts/content-tests.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const lib = require('../pb_hooks/lib/content.js')
const { parseAccess, parseVisibility, userAllowed, deploymentHosts, domainRuleProblems } = require('../pb_hooks/lib/config.js')

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

const md = (html, opts) => lib.htmlToMarkdown(html, opts).markdown

await test('drops head, scripts, styles, hidden elements and form controls', () => {
  const out = md(`<!doctype html><html><head><title>T</title><style>p{}</style></head>
    <body><!-- note --><script>alert("x</p>")</script><p>kept</p>
    <div hidden><p>gone</p></div><p aria-hidden="true">gone</p><p style="display: none">gone</p>
    <form><input value="gone" /><button>gone</button><textarea>gone</textarea><label>Name</label></form>
    <template><p>gone</p></template><svg><text>gone</text></svg><noscript>gone</noscript></body></html>`)
  assert.ok(out.includes('kept'))
  assert.ok(out.includes('Name'))
  assert.ok(!out.includes('gone'), out)
  assert.ok(!out.includes('alert'), out)
  assert.ok(!out.includes('<'), out)
})

await test('headings, paragraphs, inline formatting and entities', () => {
  const out = md('<h1>Title &amp; more</h1><p>Some <strong>bold</strong>,  <em>em</em>\n and <code>a&lt;b</code>&nbsp;&#x2192;</p><h3>Sub</h3>')
  assert.equal(out, '# Title & more\n\nSome **bold**, *em* and `a<b` →\n\n### Sub')
})

await test('links resolve against the base; fragment and javascript links become text', () => {
  const out = md(
    '<p><a href="/docs/">abs</a> <a href="page.html">rel</a> <a href="https://x.io/">ext</a> <a href="#/x">hash</a> <a href="javascript:void 0">js</a> <a href="/y"></a></p>',
    { base: 'https://c.io/hello/' }
  )
  assert.equal(out, '[abs](https://c.io/docs/) [rel](https://c.io/hello/page.html) [ext](https://x.io/) hash js')
})

await test('lists nest, implicit </li> closes, ordered lists number', () => {
  const out = md('<ul><li>one<li>two<ul><li>inner</li></ul></li></ul><ol><li>a</li><li>b</li></ol>')
  assert.equal(out, '- one\n- two\n  - inner\n\n1. a\n2. b')
})

await test('pre keeps whitespace and takes the language from code', () => {
  const out = md('<p>before</p><pre><code class="language-js">const a = 1\n  if (a &lt; 2) {}\n</code></pre><p>after</p>')
  assert.equal(out, 'before\n\n```js\nconst a = 1\n  if (a < 2) {}\n```\n\nafter')
  assert.ok(md('<pre>has ``` inside</pre>').startsWith('~~~~'))
})

await test('tables, blockquotes and rules', () => {
  const out = md('<table><thead><tr><th>a</th><th>b|c</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table><blockquote><p>q1</p><p>q2</p></blockquote><hr>')
  assert.equal(out, '| a | b\\|c |\n| --- | --- |\n| 1 |  |\n\n> q1\n>\n> q2\n\n---')
})

await test('fills replace a target element by id and report which ids matched', () => {
  const { markdown, filled } = lib.htmlToMarkdown('<h2>Book</h2><ul id="list"><li>loading</li></ul>', {
    fills: { list: '- real entry', missing: 'x' },
  })
  assert.equal(markdown, '## Book\n\n- real entry')
  assert.deepEqual(filled, ['list'])
})

await test('renderAppContent: header under the page h1, targeted and appended sections', () => {
  const out = lib.renderAppContent({
    slug: 'demo',
    origin: 'https://c.io',
    manifest: { title: 'Demo', description: 'A demo app.' },
    html: '<body><h1>Demo!</h1><p>static</p><div id="slot">loading...</div></body>',
    sections: [
      { target: 'slot', markdown: 'filled in' },
      { title: 'Extra', markdown: 'appended' },
      { target: 'nowhere', title: 'Fallback', markdown: 'lost target' },
      { title: 'Empty', markdown: '  ' },
    ],
  })
  assert.ok(out.startsWith('# Demo!\n\n> A demo app.\n\n- App: https://c.io/demo/\n'), out)
  assert.ok(out.includes('static\n\nfilled in'), out)
  assert.ok(!out.includes('loading'), out)
  assert.ok(out.includes('## Extra\n\nappended'))
  assert.ok(out.includes('## Fallback\n\nlost target'))
  assert.ok(!out.includes('## Empty'))
  assert.ok(out.endsWith('\n') && !out.endsWith('\n\n'))
})

await test('renderAppContent: synthesizes an h1 from the manifest and caps size', () => {
  const out = lib.renderAppContent({ slug: 'x', manifest: { title: 'X', icon: '🧪' }, html: '<p>body</p>' })
  assert.ok(out.startsWith('# 🧪 X\n\n- App: /x/'), out)
  const big = lib.renderAppContent({ slug: 'x', manifest: {}, html: `<p>${'y'.repeat(lib.MAX_TEXT + 10)}</p>` })
  assert.ok(big.length < lib.MAX_TEXT + 200)
  assert.ok(big.includes('[truncated at'))
})

await test('renderRootContent lists apps and marks gated ones without a content link', () => {
  const out = lib.renderRootContent({
    siteName: 'Cubby',
    origin: 'https://c.io',
    sites: [
      { name: 'hello', title: 'Hello', icon: '👋', description: 'Hi.' },
      { name: 'vault', title: 'Vault', gated: true },
    ],
  })
  assert.ok(out.startsWith('# Cubby\n'))
  assert.ok(out.includes('- [👋 Hello](https://c.io/hello/): Hi. ([content](https://c.io/_cubby/content/hello))'))
  assert.ok(out.includes('- [Vault](https://c.io/vault/) (sign-in required; no agent content)'))
  assert.ok(!out.includes('/_cubby/content/vault'))
})

await test('validateSections names each problem', () => {
  assert.deepEqual(lib.validateSections([{ markdown: 'ok', title: 't', target: 'id' }]), [])
  assert.equal(lib.validateSections('nope').length, 1)
  assert.equal(lib.validateSections([null, { markdown: 1 }, { markdown: '', target: '' }]).length, 3)
})

await test('parseAccess: absent or null is open; any block is gated, failing closed', () => {
  assert.equal(parseAccess({}), null)
  assert.equal(parseAccess({ access: null }), null)
  assert.equal(parseAccess(null), null)
  assert.deepEqual(parseAccess({ access: {} }), { allowedUsers: [] })
  assert.deepEqual(parseAccess({ access: { allowedUsers: ['*@x.com'] } }), { allowedUsers: ['*@x.com'] })
  assert.deepEqual(parseAccess({ access: true }), { allowedUsers: [] })
})

await test('parseVisibility: public by default, "access" needs a block, anything else hidden', () => {
  assert.equal(parseVisibility({}), 'public')
  assert.equal(parseVisibility({ hidden: false }), 'public')
  assert.equal(parseVisibility({ hidden: null }), 'public')
  assert.equal(parseVisibility({ hidden: true }), 'hidden')
  assert.equal(parseVisibility({ hidden: 'access', access: {} }), 'access')
  assert.equal(parseVisibility({ hidden: 'access', access: { allowedUsers: ['me@x.com'] } }), 'access')
  assert.equal(parseVisibility({ hidden: 'access' }), 'hidden')
  assert.equal(parseVisibility({ hidden: 'acess', access: {} }), 'hidden')
  assert.equal(parseVisibility({ hidden: 'true' }), 'hidden')
  assert.equal(parseVisibility(null), 'hidden')
})

await test('deploymentHosts: hostnames of domain and instanceUrl, deduplicated', () => {
  assert.deepEqual(
    deploymentHosts({ domain: 'https://cubby.pockethost.io', instanceUrl: 'https://cubby.pockethost.io/' }),
    ['cubby.pockethost.io']
  )
  assert.deepEqual(
    deploymentHosts({ domain: 'HTTPS://Apps.Example.com:8443/x?y', instanceUrl: 'http://fork.pockethost.io' }),
    ['apps.example.com', 'fork.pockethost.io']
  )
  assert.deepEqual(deploymentHosts({ domain: 'bare.example.com' }), ['bare.example.com'])
  assert.deepEqual(deploymentHosts({ domain: '', instanceUrl: 42 }), [])
  assert.deepEqual(deploymentHosts(null), [])
})

await test('parseVisibility: domain rules match the deployment hosts', () => {
  const cubby = ['cubby.pockethost.io']
  const fork = ['apps.example.com', 'fork.pockethost.io']
  const except = { hidden: { except: ['cubby.pockethost.io'] } }
  assert.equal(parseVisibility(except, cubby), 'public')
  assert.equal(parseVisibility(except, ['CUBBY.pockethost.io']), 'public')
  assert.equal(parseVisibility(except, fork), 'hidden')
  assert.equal(parseVisibility(except, []), 'hidden')
  assert.equal(parseVisibility(except), 'hidden')

  const on = { hidden: { on: ['*.pockethost.io'] } }
  assert.equal(parseVisibility(on, cubby), 'hidden')
  assert.equal(parseVisibility(on, fork), 'hidden') // any deployment host counts
  assert.equal(parseVisibility(on, ['pockethost.io']), 'public') // *. needs a subdomain
  assert.equal(parseVisibility(on, ['apps.example.com']), 'public')
  assert.equal(parseVisibility(on), 'public')

  const both = { hidden: { on: ['*.pockethost.io'], except: ['cubby.pockethost.io'] } }
  assert.equal(parseVisibility(both, cubby), 'public')
  assert.equal(parseVisibility(both, ['fork.pockethost.io']), 'hidden')
  assert.equal(parseVisibility(both, ['apps.example.com']), 'public')

  assert.equal(parseVisibility({ hidden: { on: ['*'] } }, cubby), 'hidden')
  assert.equal(parseVisibility({ hidden: { except: ['*'] } }, cubby), 'public')
})

await test('parseVisibility: malformed domain rules fail closed', () => {
  const cubby = ['cubby.pockethost.io']
  for (const hidden of [
    {},
    { on: [] },
    { except: 'cubby.pockethost.io' },
    { except: ['cubby.pockethost.io', ''] },
    { except: ['cubby.pockethost.io'], bogus: [] },
    ['cubby.pockethost.io'],
  ]) {
    assert.equal(parseVisibility({ hidden }, cubby), 'hidden', JSON.stringify(hidden))
  }
  assert.deepEqual(domainRuleProblems({ except: ['cubby.pockethost.io'] }), [])
  assert.equal(domainRuleProblems({ on: 'x', bogus: 1 }).length, 2)
  assert.deepEqual(domainRuleProblems({ on: [] }), ['needs at least one domain in "on" or "except"'])
})

await test('userAllowed: empty list admits any signed-in user, else a glob must match', () => {
  assert.equal(userAllowed({ allowedUsers: [] }, 'anyone@x.com'), true)
  assert.equal(userAllowed({ allowedUsers: [] }, ''), false)
  assert.equal(userAllowed({ allowedUsers: ['me@x.com'] }, 'Me@X.com'), true)
  assert.equal(userAllowed({ allowedUsers: ['me@x.com'] }, 'you@x.com'), false)
  assert.equal(userAllowed({ allowedUsers: ['*@x.com'] }, 'you@x.com'), true)
  assert.equal(userAllowed({ allowedUsers: ['*@x.com'] }, 'you@y.com'), false)
  assert.equal(userAllowed(null, 'me@x.com'), false)
})

await test('normalizeRoute: hash, slashes and junk', () => {
  assert.equal(lib.normalizeRoute('#/r/falernum-ryan'), '/r/falernum-ryan')
  assert.equal(lib.normalizeRoute('r/falernum-ryan/'), '/r/falernum-ryan')
  assert.equal(lib.normalizeRoute('/r/x'), '/r/x')
  assert.equal(lib.normalizeRoute(''), '')
  assert.equal(lib.normalizeRoute('#/'), '')
  assert.equal(lib.normalizeRoute(undefined), '')
  assert.equal(lib.normalizeRoute('a\nb'), null)
  assert.equal(lib.normalizeRoute('x'.repeat(501)), null)
})

await test('contentUrl builds absolute snapshot URLs with encoded segments', () => {
  assert.equal(lib.contentUrl('https://c.io', 'recipes', '#/r/x'), 'https://c.io/_cubby/content/recipes/r/x')
  assert.equal(lib.contentUrl('https://c.io', 'recipes', ''), 'https://c.io/_cubby/content/recipes')
  assert.equal(lib.contentUrl('', 'recipes', '/tag/a b'), '/_cubby/content/recipes/tag/a%20b')
})

await test('hash links map to route snapshots only when the app answers routes', () => {
  const html = '<p><a href="#/r/x">rel</a> <a href="/recipes/#/r/y">abs</a> <a href="#top">frag</a></p>'
  const base = 'https://c.io/recipes/'
  assert.equal(lib.htmlToMarkdown(html, { base }).markdown, 'rel [abs](https://c.io/recipes/#/r/y) frag')
  const routeHref = (route) => lib.contentUrl('https://c.io', 'recipes', route)
  assert.equal(
    lib.htmlToMarkdown(html, { base, routeHref }).markdown,
    '[rel](https://c.io/_cubby/content/recipes/r/x) [abs](https://c.io/_cubby/content/recipes/r/y) frag'
  )
  const app = lib.renderAppContent({ slug: 'recipes', origin: 'https://c.io', manifest: {}, html, routes: true })
  assert.ok(app.includes('[rel](https://c.io/_cubby/content/recipes/r/x)'), app)
})

await test('renderRouteContent: one view under a header tying it to page and app', () => {
  const out = lib.renderRouteContent({
    slug: 'recipes',
    origin: 'https://c.io',
    manifest: { title: 'Recipes', description: 'The family recipe box.' },
    route: '/r/falernum',
    result: { title: 'Falernum', markdown: '## Ingredients\n\n- lime' },
  })
  assert.equal(
    out,
    '# Falernum\n\n> Recipes: The family recipe box.\n\n' +
      '- Page: https://c.io/recipes/#/r/falernum\n- App snapshot: https://c.io/_cubby/content/recipes\n' +
      '- This is a server-rendered text snapshot of one view of an app that renders in the browser.\n\n' +
      '## Ingredients\n\n- lime\n'
  )
  const custom = lib.renderRouteContent({ slug: 'hello', manifest: {}, route: '/abc', result: { markdown: 'x', pageUrl: '/hello/abc' } })
  assert.ok(custom.startsWith('# hello /abc\n'))
  assert.ok(custom.includes('- Page: /hello/abc\n'))
})

await test('validateRouteResult: null is a miss, objects need markdown', () => {
  assert.deepEqual(lib.validateRouteResult(null), [])
  assert.deepEqual(lib.validateRouteResult({ markdown: 'x', title: 't', pageUrl: '/p' }), [])
  assert.equal(lib.validateRouteResult('x').length, 1)
  assert.equal(lib.validateRouteResult({ title: 1 }).length, 2)
})

await test('the build-owned noscript hint never lands inside a snapshot', () => {
  const html = readFileSync(new URL('../pb_public/hello/index.html', import.meta.url), 'utf8')
  assert.ok(html.includes('<noscript data-cubby-content>'), 'the build injected the hint')
  assert.ok(!md(html).includes('renders with JavaScript'))
})

// publicRecords against a fake JSVM app: findRecordsByFilter slices `rows`
// by limit/offset, canAccessRecord asks `passes`, and both count their calls.
globalThis.RequestInfo = class RequestInfo {
  constructor(info) {
    Object.assign(this, info)
  }
}
const FIELDS = [
  { name: 'id', type: 'text' },
  { name: 'title', type: 'text' },
  { name: 'data', type: 'json' },
  { name: 'secret', type: 'text', hidden: true },
]
function fakeApp({ listRule = '', system = false, rows = [], passes = () => true } = {}) {
  const calls = { queries: [], checks: [] }
  const app = {
    findCollectionByNameOrId: () => ({ system, toJSON: () => ({ listRule, fields: FIELDS }) }),
    findRecordsByFilter: (name, filter, sort, limit, offset, params) => {
      calls.queries.push({ name, filter, sort, limit, offset, params })
      return rows.slice(offset, offset + limit)
    },
    canAccessRecord: (row, info, rule) => {
      calls.checks.push({ row, info, rule })
      return passes(row)
    },
  }
  return { app, calls }
}
// get(k) on a json field is raw bytes in the JSVM; getString(k) is its text.
const row = (n, extra) => ({
  id: `r${n}`,
  n,
  title: `t${n}`,
  ...extra,
  get(k) {
    return k === 'data' ? [...Buffer.from(JSON.stringify(this[k]))] : this[k]
  },
  getString(k) {
    return k === 'data' ? JSON.stringify(this[k] ?? null) : String(this[k] ?? '')
  },
})
const rowsOf = (count) => Array.from({ length: count }, (_, i) => row(i))

await test('publicRecords: listRule "" is one query with no per-row checks', () => {
  const { app, calls } = fakeApp({ rows: rowsOf(30) })
  const out = lib.publicRecords(app, 'demo_items', { sort: '-created', limit: 25, filter: 'n > {:n}', params: { n: 1 } })
  assert.equal(out.length, 25)
  assert.equal(calls.queries.length, 1)
  assert.deepEqual(calls.queries[0], { name: 'demo_items', filter: 'n > {:n}', sort: '-created', limit: 25, offset: 0, params: { n: 1 } })
  assert.equal(calls.checks.length, 0)
  assert.deepEqual(out[0], { id: 'r0', n: 0, title: 't0' }, 'rows are plain JSON')
  assert.equal(lib.publicRecords(fakeApp({ rows: rowsOf(300) }).app, 'demo_items', { limit: 999 }).length, 200)
  assert.equal(lib.publicRecords(fakeApp({ rows: rowsOf(300) }).app, 'demo_items').length, 20)
})

await test('publicRecords: a conditional rule keeps only rows an anonymous request may list', () => {
  const rule = "published = true || owner = @request.auth.id"
  const { app, calls } = fakeApp({ listRule: rule, rows: rowsOf(10), passes: (r) => r.n % 2 === 0 })
  const out = lib.publicRecords(app, 'demo_items')
  assert.deepEqual(out.map((r) => r.id), ['r0', 'r2', 'r4', 'r6', 'r8'])
  assert.equal(calls.checks.length, 10)
  for (const check of calls.checks) {
    assert.equal(check.rule, rule)
    assert.ok(check.info instanceof RequestInfo)
    assert.equal(check.info.method, 'GET')
    assert.equal(check.info.context, 'default')
    assert.equal(check.info.auth, undefined, 'checked signed out')
  }
})

await test('publicRecords: pages past rejected rows to fill the limit', () => {
  const { app, calls } = fakeApp({ listRule: 'published = true', rows: rowsOf(1000), passes: (r) => r.n % 3 === 0 })
  const out = lib.publicRecords(app, 'demo_items', { limit: 50 })
  assert.equal(out.length, 50)
  assert.equal(out[49].id, 'r147')
  assert.equal(calls.queries.length, 2)
  assert.deepEqual(calls.queries.map((q) => [q.limit, q.offset]), [[100, 0], [100, 100]])
})

await test('publicRecords: a rule that passes nothing stops after 2000 rows', () => {
  const { app, calls } = fakeApp({ listRule: 'published = true', rows: rowsOf(5000), passes: () => false })
  assert.deepEqual(lib.publicRecords(app, 'demo_items', { limit: 10 }), [])
  assert.equal(calls.checks.length, 2000)
  assert.equal(calls.queries.length, 20)
  const short = fakeApp({ listRule: 'published = true', rows: rowsOf(150), passes: () => false })
  lib.publicRecords(short.app, 'demo_items')
  assert.equal(short.calls.queries.length, 2, 'a short batch ends the scan')
})

await test('publicRecords: superuser-only rules, system collections and bad names throw', () => {
  assert.throws(() => lib.publicRecords(fakeApp({ listRule: null }).app, 'demo_items'), /superusers only/)
  assert.throws(() => lib.publicRecords(fakeApp({ system: true }).app, 'demo_items'), /not publicly listable/)
  assert.throws(() => lib.publicRecords(fakeApp().app, 'Bad'), /invalid collection/)
  assert.throws(() => lib.publicRecords(fakeApp().app, undefined), /invalid collection/)
})

await test('publicRecords: JSVM wrappers come back as plain values', () => {
  // A JSVM record marshals through publicExport(): json fields as JSON, dates as strings.
  const wrapped = { id: 'r1', toJSON: () => ({ id: 'r1', data: { a: 1 }, when: '' }) }
  const [out] = lib.publicRecords(fakeApp({ rows: [wrapped] }).app, 'demo_items')
  assert.deepEqual(out, { id: 'r1', data: { a: 1 }, when: '' })
})

await test('publicRecords: fields trims rows to id plus the named public fields', () => {
  const rows = [row(1, { data: { big: [1, 2, 3] }, secret: 's' })]
  assert.deepEqual(lib.publicRecords(fakeApp({ rows }).app, 'demo_items', { fields: ['title'] }), [{ id: 'r1', title: 't1' }])
  assert.deepEqual(lib.publicRecords(fakeApp({ rows }).app, 'demo_items', { fields: ['data', 'id', 'data'] }), [
    { id: 'r1', data: { big: [1, 2, 3] } },
  ], 'json fields are parsed, not byte codes')
  const unset = [row(2, { data: undefined })]
  assert.deepEqual(lib.publicRecords(fakeApp({ rows: unset }).app, 'demo_items', { fields: ['data'] }), [{ id: 'r2', data: null }])
  assert.throws(() => lib.publicRecords(fakeApp({ rows }).app, 'demo_items', { fields: ['nope'] }), /no public field "nope"/)
  assert.throws(() => lib.publicRecords(fakeApp({ rows }).app, 'demo_items', { fields: ['secret'] }), /no public field "secret"/)
  assert.throws(() => lib.publicRecords(fakeApp({ rows }).app, 'demo_items', { fields: 'title' }), /array of field names/)
  assert.throws(() => lib.publicRecords(fakeApp({ rows }).app, 'demo_items', { fields: [1] }), /array of field names/)
})

await test('the real hello page converts with its sections and no markup', () => {
  const html = readFileSync(new URL('../pb_public/hello/index.html', import.meta.url), 'utf8')
  const manifest = JSON.parse(readFileSync(new URL('../pb_public/hello/cubby.json', import.meta.url), 'utf8'))
  const out = lib.renderAppContent({
    slug: 'hello',
    manifest,
    html,
    origin: 'https://c.io',
    sections: [{ target: 'guestbook-list', markdown: '- a message' }],
  })
  assert.ok(out.startsWith('# 👋 Hello\n'), out.slice(0, 200))
  assert.ok(out.includes('## Guestbook'))
  assert.ok(out.includes('- a message'))
  assert.ok(out.includes('[The docs](https://c.io/docs/)'))
  assert.ok(!/<[a-z/!]/i.test(out), 'no markup survives')
  assert.ok(!out.includes('ld+json'))
})

await test('the real docs page keeps its sections and code examples', () => {
  const html = readFileSync(new URL('../pb_public/docs/index.html', import.meta.url), 'utf8')
  const out = md(html, { base: 'https://c.io/docs/' })
  const headings = out.split('\n').filter((l) => /^#{1,3} /.test(l))
  assert.ok(headings.length >= 15, `got ${headings.length} headings`)
  assert.ok(out.includes('```'), 'code examples survive as fences')
})

console.log(passed === 0 ? 'no tests ran' : process.exitCode ? 'CONTENT TESTS FAILED' : `all ${passed} tests passed`)
process.exit(process.exitCode || 0)
