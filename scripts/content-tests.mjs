// Agent-readable content tests. Pure Node, no server: loads the pure core of
// pb_hooks/lib/content.js (HTML -> markdown, snapshot assembly) and
// parseAccess from pb_hooks/lib/config.js, then runs the real app pages
// through the converter.
//
//   node scripts/content-tests.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const lib = require('../pb_hooks/lib/content.js')
const { parseAccess } = require('../pb_hooks/lib/config.js')

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
