// Permalink tests. Pure Node, no server: loads pb_hooks/lib/permalink.js
// with the few JSVM globals it reads (__hooks, $os, toString) pointed at a
// temporary pb_public/pb_hooks tree, then checks manifest loading for both
// modes (record and hook), the text helpers, hook output normalization and
// the in-place shell rewrite. The route itself runs in the JSVM; smoke.mjs
// covers it against a live server.
//
//   node scripts/permalink-tests.mjs
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'

const tree = mkdtempSync(path.join(tmpdir(), 'cubby-permalink-'))
globalThis.__hooks = path.join(tree, 'pb_hooks')
globalThis.toString = (b) => Buffer.from(b).toString('utf8')
globalThis.$os = {
  readFile: (p) => readFileSync(p),
  stat: (p) => statSync(p),
  readDir: (p) => readdirSync(p, { withFileTypes: true }).map((d) => ({ name: () => d.name, isDir: () => d.isDirectory() })),
}
const logged = []
const realLog = console.log
console.log = (...args) => logged.push(args.join(' '))

function app(name, manifest, { module = false } = {}) {
  mkdirSync(path.join(tree, 'pb_public', name), { recursive: true })
  writeFileSync(path.join(tree, 'pb_public', name, 'cubby.json'), JSON.stringify({ name, ...manifest }))
  if (module) {
    mkdirSync(path.join(tree, 'pb_hooks', 'apps', name), { recursive: true })
    writeFileSync(path.join(tree, 'pb_hooks', 'apps', name, 'permalink.js'), 'module.exports = { resolve: () => null }\n')
  }
}
app('records', { permalink: { collection: 'records_items', title: '{title}' } })
app('computed', { permalink: { hook: true, home: 'default' } }, { module: true })
app('both', { permalink: { collection: 'both_items', hook: true } }, { module: true })
app('unwired', { permalink: { hook: true } })
app('plain', {})
app('nohook', { permalink: { hook: 'yes' } })

const lib = createRequire(import.meta.url)('../pb_hooks/lib/permalink.js')

let passed = 0
async function test(name, fn) {
  try {
    await fn()
    passed++
    realLog(`ok   ${name}`)
  } catch (err) {
    console.error(`FAIL ${name}`)
    console.error(err)
    process.exitCode = 1
  }
}

await test('manifests: record mode, hook mode, and what is not a permalink', () => {
  const rec = lib.loadAppPermalink('records')
  assert.equal(rec.hook, false)
  assert.equal(rec.collection, 'records_items')
  assert.equal(rec.param, 'slug')
  assert.deepEqual(lib.loadAppPermalink('computed'), { hook: true, home: 'default' })
  assert.equal(lib.loadAppPermalink('both').hook, false, 'a collection wins over hook at runtime')
  assert.equal(lib.loadAppPermalink('plain'), null)
  assert.equal(lib.loadAppPermalink('nohook'), null, 'hook must be exactly true')
  assert.equal(lib.loadAppPermalink('missing'), null)
})

await test('permalinkApps routes hook apps only when their module exists', () => {
  logged.length = 0
  assert.deepEqual(lib.permalinkApps().sort(), ['both', 'computed', 'records'])
  assert.ok(logged.some((l) => l.includes('unwired') && l.includes('permalink.js')), logged.join('\n'))
})

await test('clampText and stripMarkdown clamp on a word boundary', () => {
  assert.equal(lib.clampText('  short   text '), 'short text')
  assert.equal(lib.clampText('one two three four five six', 14), 'one two three…')
  assert.equal(lib.clampText('x'.repeat(30), 10), 'xxxxxxxxxx…')
  assert.equal(lib.stripMarkdown('**Bold** [plans](https://x.io) & `code`'), 'Bold plans & code')
  assert.equal(lib.stripMarkdown('word '.repeat(60)).length <= 151, true)
})

await test('hookMeta: null means no slug; text clamped; images absolute or origin-relative', () => {
  const origin = 'https://cubby.example'
  for (const out of [null, undefined, false, 'title', 42]) assert.equal(lib.hookMeta(out, origin), null)
  assert.deepEqual(lib.hookMeta({}, origin), {}, 'an empty object keeps every static tag')
  const meta = lib.hookMeta({ title: `  A\n title ${'x'.repeat(200)}`, description: 'd'.repeat(400), image: '/_cubby/apps/x/og/1.png?v=2' }, origin)
  assert.ok(meta.title.startsWith('A title '))
  assert.ok(meta.title.length <= 121)
  assert.ok(meta.description.length <= 151)
  assert.equal(meta.image, 'https://cubby.example/_cubby/apps/x/og/1.png?v=2')
  assert.equal(lib.hookMeta({ image: 'https://cdn.example/a.png' }, origin).image, 'https://cdn.example/a.png')
  for (const image of ['//evil.example/a.png', 'javascript:alert(1)', 'data:image/png;base64,AA', 'a.png', 7]) {
    assert.equal(lib.hookMeta({ image }, origin).image, undefined, String(image))
  }
  assert.deepEqual(lib.hookMeta({ title: 7, description: ['x'] }, origin), {}, 'non-strings ignored')
})

const shell = `<!doctype html><html><head>
    <title>Static</title>
    <meta name="description" content="static description" />
    <meta property="og:title" content="Static" />
    <meta property="og:description" content="static description" />
    <meta property="og:url" content="https://cubby.example/app/" />
    <meta property="og:image" content="https://cubby.example/og.png" />
  </head><body></body></html>`
const tag = (html, name) => html.match(new RegExp(`(?:property|name)="${name}"\\s+content="([^"]*)"`))?.[1]

await test('applyOg rewrites in place, escapes, and keeps statics for absent values', () => {
  const html = lib.applyOg(shell, { title: 'Costs $1 & "more" <b>', description: 'd $& e', url: 'https://cubby.example/app/x', image: 'https://cubby.example/i.png?a=1&b=2' })
  assert.match(html, /<title>Costs \$1 &amp; &quot;more&quot; &lt;b&gt;<\/title>/)
  assert.equal(tag(html, 'og:title'), 'Costs $1 &amp; &quot;more&quot; &lt;b&gt;')
  assert.equal(tag(html, 'og:description'), 'd $&amp; e', '$& is literal, not the match')
  assert.equal(tag(html, 'description'), 'd $&amp; e')
  assert.equal(tag(html, 'og:url'), 'https://cubby.example/app/x')
  assert.equal(tag(html, 'og:image'), 'https://cubby.example/i.png?a=1&amp;b=2')
  const kept = lib.applyOg(shell, { url: 'https://cubby.example/app/y' })
  assert.match(kept, /<title>Static<\/title>/)
  assert.equal(tag(kept, 'og:image'), 'https://cubby.example/og.png')
  assert.equal(tag(kept, 'og:url'), 'https://cubby.example/app/y')
})

console.log = realLog
rmSync(tree, { recursive: true, force: true })
console.log(`permalink: ${passed} tests passed`)
