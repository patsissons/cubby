// cubby core tests. Pure Node, no server, no DOM: imports the built ESM
// bundles (the shipped artifacts, mirroring the smoke philosophy).
//
//   npm run build
//   node scripts/core-tests.mjs
//
// The bundle-layout assertions in the first group are the guardrail for the
// whole module split. Everything else here is ordinary unit testing.
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const bundle = (file) => readFileSync(path.join(root, 'pb_public/js', file), 'utf8')

const core = await import('../pb_public/js/core.esm.js')
const markdown = await import('../pb_public/js/markdown.esm.js')
const platform = await import('../pb_public/js/platform.esm.js')
const preview = await import('../pb_public/js/preview.esm.js')
const draw = await import('../pb_public/js/draw.esm.js')
const graph = await import('../pb_public/js/graph.esm.js')

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

// --- bundle layout: one CubbyError, everywhere ------------------------------
//
// markdown.js used to `import '../errors.js'` directly, so it shipped a second
// CubbyError class and every error cubby.markdown threw failed an instanceof
// check against cubby.CubbyError. With a bundle per feature that mistake would
// have multiplied. These two tests are what stop it coming back.

await test('errors thrown across bundles are the one canonical CubbyError', () => {
  assert.equal(platform.CubbyError, core.CubbyError, 'platform must not define its own')
  assert.equal(platform.default.CubbyError, core.CubbyError, 'the namespace exposes the same class')

  // The property that actually matters, and the one that was broken before:
  // an error thrown by a DIFFERENT bundle must pass instanceof against core's
  // class. pb_public/hello/app.js had to check err.code because this was false.
  const md = markdown.createMarkdown({})
  assert.throws(
    () => md.editor('#anything'),
    (err) => err instanceof core.CubbyError && err.code === 'editor_moved',
    'a CubbyError thrown by markdown.esm.js is instanceof core.esm.js CubbyError'
  )
})

await test('no bundle but core (and standalone foundation.js) defines CubbyError', () => {
  // Minifiers rename classes but never the string literal in this.name.
  const defines = (file) => (bundle(file).match(/name="CubbyError"/g) || []).length

  assert.equal(defines('core.js'), 1, 'core.js defines the class')
  assert.equal(defines('core.esm.js'), 1, 'core.esm.js defines the class')
  // The deprecated all-in-one must stay standalone: pages cached before the
  // split have no core.js tag beside it, so it inlines core on purpose.
  assert.equal(defines('foundation.js'), 1, 'foundation.js inlines core deliberately')

  for (const file of ['platform.js', 'markdown.js']) {
    assert.equal(defines(file), 0, `${file} must borrow CubbyError, not bundle its own`)
  }
  for (const file of ['platform.esm.js', 'markdown.esm.js', 'foundation.esm.js']) {
    assert.equal(defines(file), 0, `${file} must import CubbyError`)
    assert.match(bundle(file), /from"\.\/core\.esm\.js"/, `${file} must import ./core.esm.js`)
  }
})

await test('IIFE bundles read core off window.cubby', () => {
  for (const file of ['platform.js', 'markdown.js']) {
    assert.match(bundle(file), /window\.cubby/, `${file} must read the shared namespace`)
  }
})

// --- the IIFE path, which is what browsers actually load ---------------------
//
// Nothing else exercises the window-shim mechanism or the defer-order
// contract. Evaluating the real bundles in a vm with a stub window is the
// closest thing to a browser this suite can be, and it catches the two
// failures that matter: a widget that bundles its own core, and a widget that
// attaches itself when its hard dependency is missing.

/** Evaluate IIFE bundles in order against one shared fake window. */
function loadScripts(...files) {
  const errors = []
  const win = {}
  const sandbox = {
    window: win,
    console: { ...console, error: (...args) => errors.push(args.join(' ')) },
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  for (const file of files) {
    vm.runInContext(bundle(file), sandbox, { filename: file })
  }
  return { cubby: win.cubby, errors }
}

await test('core.js then markdown.js: one namespace, one error class', () => {
  const { cubby, errors } = loadScripts('core.js', 'markdown.js')
  assert.deepEqual(errors, [], 'a correctly ordered page must log nothing')
  assert.equal(typeof cubby.CubbyError, 'function', 'core.js created the namespace')
  assert.equal(typeof cubby.markdown.render, 'function', 'markdown.js attached onto it')
  assert.equal(cubby.markdown.render('**hi**').trim(), '<p><strong>hi</strong></p>')

  // The whole point of the shim: markdown throws core's class, not its own.
  // The editor moved to its own bundle; the old name forwards, and names the
  // tag you need when the new bundle is absent.
  assert.throws(
    () => cubby.markdown.editor('#x'),
    (err) => err instanceof cubby.CubbyError && err.code === 'editor_moved'
  )
})

await test('markdown.js without core.js logs once and attaches nothing', () => {
  const { cubby, errors } = loadScripts('markdown.js')
  assert.equal(cubby, undefined, 'a missing hard dep must not half-create the namespace')
  assert.equal(errors.length, 1, 'exactly one message, not one per call')
  assert.match(errors[0], /core\.js/, 'the message names the missing tag')
  assert.match(errors[0], /defer/, 'and the corrective tag order')
})

await test('foundation.js alone still works, standalone', () => {
  // The deprecated bundle has to keep working with no core.js beside it:
  // pages cached before the split have only this one tag.
  const { cubby, errors } = loadScripts('foundation.js')
  assert.deepEqual(errors, [])
  assert.equal(typeof cubby.CubbyError, 'function')
  assert.equal(typeof cubby.db, 'object', 'and still carries the platform')
})

await test('foundation.js loaded after platform.js declines and says so', () => {
  const warnings = []
  const win = {}
  const sandbox = { window: win, console: { ...console, warn: (...a) => warnings.push(a.join(' ')) } }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  for (const file of ['core.js', 'platform.js', 'foundation.js']) {
    vm.runInContext(bundle(file), sandbox, { filename: file })
  }
  assert.equal(warnings.length, 1, 'carrying both tags is worth one warning')
  assert.match(warnings[0], /already loaded/)
  // and critically, only ONE PocketBase client exists
  assert.equal(typeof win.cubby._pb, 'object')
})

await test('editor.js needs markdown and says so exactly once', () => {
  const withMarkdown = loadScripts('core.js', 'markdown.js', 'editor.js')
  assert.deepEqual(withMarkdown.errors, [])
  assert.equal(typeof withMarkdown.cubby.editor, 'function')

  const without = loadScripts('core.js', 'editor.js')
  assert.equal(without.cubby.editor, undefined, 'must not attach without its renderer')
  assert.equal(without.errors.length, 1)
  assert.match(without.errors[0], /markdown\.js/)
})

await test('editor.js carries no second renderer and no second error class', () => {
  const js = bundle('editor.js')
  assert.equal((js.match(/name="CubbyError"/g) || []).length, 0)
  // Renderer-only markup that markdown.js emits and the editor must not.
  assert.ok(bundle('markdown.js').includes('blockquote'), 'sanity: markdown.js renders')
  assert.ok(!js.includes('blockquote'), 'editor.js must borrow render, not bundle it')
  // Its own chrome, however, is its own now.
  assert.ok(js.includes('cubby-md-tab'), 'editor.js owns the editor stylesheet')
  assert.ok(!bundle('markdown.js').includes('cubby-md-tab'), 'and markdown.js has shed it')
})

await test('the editor degrades to a plain composer with no platform, silently', () => {
  // The brief's rule: absence of a platform is a supported configuration, not
  // a failure. Nothing may be logged, and the preview must still work.
  const { cubby, errors } = loadScripts('core.js', 'markdown.js', 'editor.js')
  assert.deepEqual(errors, [], 'core + markdown + editor alone must log nothing')
  assert.equal(cubby.hasPlatform(), false, 'no platform is present')
  assert.equal(typeof cubby.editor, 'function', 'and the editor is still available')
  assert.equal(typeof cubby.markdown.render, 'function', 'and the preview renderer works')
})

await test('every app page lists its cubby tags in a workable order', () => {
  const pagesDir = path.join(root, 'pb_public')
  const pages = readdirSync(pagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== 'js' && e.name !== 'css')
    .map((e) => path.join(e.name, 'index.html'))
    .filter((rel) => existsSync(path.join(pagesDir, rel)))
  pages.unshift('index.html')

  for (const rel of pages) {
    const html = readFileSync(path.join(pagesDir, rel), 'utf8')
    // Platform tags only -- an app's own app.js needs a real DOM.
    const tags = [...html.matchAll(/<script\b[^>]*?src="\/js\/([^"?]+)[^"]*"/g)].map((m) => m[1])
    assert.ok(tags.length, `${rel} loads no cubby bundle at all`)

    const { cubby, errors } = loadScripts(...tags)
    assert.deepEqual(errors, [], `${rel} has its tags in the wrong order: ${tags.join(', ')}`)
    assert.equal(typeof cubby?.CubbyError, 'function', `${rel} did not end up with a namespace`)
  }
})

// --- core is DOM-free at its top level --------------------------------------

await test('importing core under plain Node does not throw', () => {
  assert.equal(typeof document, 'undefined', 'this suite must run without a DOM')
  assert.equal(typeof core.attachCore, 'function')
})

await test('style injection is a silent no-op with no document', () => {
  assert.doesNotThrow(() => core.injectStyle('probe', 'body{}'))
  assert.doesNotThrow(() => core.ensureTokens())
})

// --- errors -----------------------------------------------------------------

await test('CubbyError carries code, status and cause', () => {
  const err = new core.CubbyError('bad_path', 'nope', { status: 400, cause: 'why' })
  assert.equal(err.name, 'CubbyError')
  assert.equal(err.code, 'bad_path')
  assert.equal(err.status, 400)
  assert.equal(err.cause, 'why')
  assert.ok(err instanceof Error)
  // message defaults to the code so a bare throw still reads sensibly
  assert.equal(new core.CubbyError('not_found').message, 'not_found')
})

await test('toCubbyError maps status and passes CubbyErrors through', () => {
  const original = new core.CubbyError('bad_request', 'x')
  assert.equal(core.toCubbyError(original), original, 'must not re-wrap')

  assert.equal(core.toCubbyError({ status: 401 }).code, 'auth_required')
  assert.equal(core.toCubbyError({ status: 403 }).code, 'auth_required')
  assert.equal(core.toCubbyError({ status: 404 }).code, 'not_found')
  assert.equal(core.toCubbyError({ status: 500 }, 'provider_error').code, 'provider_error')
  assert.equal(core.toCubbyError({ status: 404 }).status, 404, 'status is preserved')

  // Non-Error inputs must not explode -- fetch and the PB SDK both throw
  // things that are not Errors.
  for (const input of ['a string', undefined, null, 0, { message: 'plain' }]) {
    const err = core.toCubbyError(input, 'unknown')
    assert.ok(err instanceof core.CubbyError, `${JSON.stringify(input)} became a CubbyError`)
    assert.equal(err.code, 'unknown')
  }
})

// --- escaping and URL vetting -----------------------------------------------

await test('escapeHtml covers all five specials', () => {
  assert.equal(core.escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;')
  assert.equal(core.escapeHtml(123), '123', 'non-strings are coerced')
})

await test('sanitizeUrl allows http, https, relative and mailto-in-links', () => {
  assert.equal(core.sanitizeUrl('https://example.com/a?b=1#c'), 'https://example.com/a?b=1#c')
  assert.equal(core.sanitizeUrl('http://example.com'), 'http://example.com')
  assert.equal(core.sanitizeUrl('/relative/path'), '/relative/path')
  assert.equal(core.sanitizeUrl('#anchor'), '#anchor')
  assert.equal(core.sanitizeUrl('mailto:a@b.c'), 'mailto:a@b.c')
  assert.equal(core.sanitizeUrl('mailto:a@b.c', { image: true }), '', 'not a valid image source')
})

await test('sanitizeUrl refuses script-bearing schemes, including obfuscated ones', () => {
  for (const url of [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    '  javascript:alert(1)',
    '\x00javascript:alert(1)',
    'data:text/html,<script>',
    'vbscript:msgbox',
    'file:///etc/passwd',
  ]) {
    assert.equal(core.sanitizeUrl(url), '', `must refuse ${JSON.stringify(url)}`)
  }
  assert.equal(core.sanitizeUrl(null), '', 'non-strings are refused')
  assert.equal(core.sanitizeUrl(undefined), '')
})

// --- markdown/editor split ---------------------------------------------------

await test('markdown.js no longer carries the editor', () => {
  const md = bundle('markdown.js')
  const ed = bundle('editor.js')
  // An app that only renders markdown should not pay for a textarea it never
  // mounts, in code or in CSS.
  // Markers only the IMPLEMENTATION produces -- "attachImageUpload" would be a
  // false positive, since markdown.js still carries that name as a string in
  // its forwarding accessor.
  for (const marker of ['cubby-md-tab', 'cubby-md-input', 'image/webp', 'Uploading ']) {
    assert.ok(!md.includes(marker), `markdown.js must not contain ${marker}`)
    assert.ok(ed.includes(marker), `editor.js must contain ${marker}`)
  }
  // and it kept what it is for
  assert.ok(md.includes('cubby-markdown'), 'markdown.js still styles rendered content')
  assert.ok(!ed.includes('blockquote'), 'editor.js still borrows the renderer')
})

await test('the moved members forward when editor.js is present', () => {
  const editorFn = () => 'mounted'
  editorFn.attachImageUpload = () => 'attached'
  const ns = { editor: editorFn }
  const md = markdown.createMarkdown(ns)

  assert.equal(md.editor, editorFn, 'cubby.markdown.editor forwards to cubby.editor')
  assert.equal(md.attachImageUpload(), 'attached')
})

await test('the moved members name the missing tag rather than being undefined', () => {
  const md = markdown.createMarkdown({})
  for (const name of ['editor', 'attachImageUpload']) {
    assert.throws(
      () => md[name],
      (err) => {
        assert.ok(err instanceof core.CubbyError)
        assert.equal(err.code, 'editor_moved')
        // "undefined is not a function", thrown from inside a minified bundle,
        // tells a caller nothing about what to do next.
        assert.match(err.message, /editor\.js/)
        return true
      },
      `${name} must point at the tag`
    )
  }
})

// --- preview: the framing allowlist -----------------------------------------
//
// A blocked frame cannot be detected from JavaScript -- no error event fires,
// and load may still run on the blocked shell -- so "try it and fall back" is
// not implementable. Framing is therefore an allowlist of MEASURED hosts, and
// getting its matching wrong is a security bug, not a cosmetic one.

const frameable = (href, allow = [], origin = 'https://cubby.test') =>
  preview.isFrameable(href, { allow, origin })

await test('same-origin is always frameable', () => {
  assert.equal(frameable('/docs/'), true, 'a site can always frame its own pages')
  assert.equal(frameable('https://cubby.test/hello/'), true)
  assert.equal(frameable('not-a-url'), true, 'a bare word IS a relative URL against the origin')
  assert.equal(frameable('https://other.test/'), false, 'and nothing else is, by default')
})

await test('a bare allowlist entry is an EXACT host', () => {
  assert.equal(frameable('https://example.com/x', ['example.com']), true)
  // The control that matters: a suffix rule admitting this passes every
  // positive test while being useless.
  assert.equal(frameable('https://evilexample.com/x', ['example.com']), false)
  assert.equal(frameable('https://sub.example.com/x', ['example.com']), false, 'exact means exact')
})

await test('a leading dot means subdomain at any depth, and nothing else', () => {
  assert.equal(frameable('https://example.com/x', ['.example.com']), true, 'and the bare domain')
  assert.equal(frameable('https://a.example.com/x', ['.example.com']), true)
  assert.equal(frameable('https://a.b.c.example.com/x', ['.example.com']), true, 'any depth')
  // The second hostile control: the allowed domain appears in the middle of
  // an attacker's hostname.
  assert.equal(frameable('https://x.example.com.evil.com/', ['.example.com']), false)
  assert.equal(frameable('https://evilexample.com/', ['.example.com']), false)
})

await test('only http and https ever reach frame.src', () => {
  for (const href of [
    'javascript:alert(1)',
    'data:text/html,<script>',
    'file:///etc/passwd',
    'ftp://example.com/x',
    'vbscript:msgbox',
  ]) {
    assert.equal(frameable(href, ['example.com']), false, `must refuse ${href}`)
  }
})

await test('allowlist matching ignores case and stray whitespace', () => {
  assert.equal(frameable('https://EXAMPLE.com/x', ['example.com']), true)
  assert.equal(frameable('https://example.com/x', ['  Example.COM  ']), true)
  assert.equal(frameable('https://example.com/x', ['', null, undefined, 'example.com']), true)
})

await test('resolveUrl refuses garbage without throwing', () => {
  assert.equal(preview.resolveUrl('http://[', 'https://cubby.test'), null)
  assert.ok(preview.resolveUrl('/x', 'https://cubby.test') instanceof URL)
})

// --- draw: path simplification ----------------------------------------------
//
// This is what makes one-event-per-segment affordable. Pointer input arrives at
// 60-120Hz and almost all of it is noise; if simplification under-cuts, the
// payload grows, and if it over-cuts, the stroke changes shape.

await test('simplify keeps the shape and drops the noise', () => {
  // A straight run of collinear points must collapse to its endpoints.
  const line = Array.from({ length: 50 }, (_, i) => [i / 49, i * 2])
  assert.deepEqual(draw.simplify(line, 0.001), [line[0], line[49]])

  // A corner must survive: the vertex carries the shape.
  const corner = [[0, 0], [0.25, 0], [0.5, 0], [0.5, 50], [0.5, 100]]
  const kept = draw.simplify(corner, 0.001)
  assert.equal(kept.length, 3, 'start, vertex, end')
  assert.deepEqual(kept[1], [0.5, 0], 'and the vertex is the corner itself')
})

await test('simplify leaves short paths and junk alone', () => {
  assert.deepEqual(draw.simplify([], 0.01), [])
  assert.deepEqual(draw.simplify([[0, 0]], 0.01), [[0, 0]])
  assert.deepEqual(draw.simplify([[0, 0], [1, 1]], 0.01), [[0, 0], [1, 1]])
  assert.deepEqual(draw.simplify(null, 0.01), [])
})

await test('simplify terminates on a long pathological path', () => {
  // Iterative, not recursive: a few thousand points must not blow the stack.
  const zigzag = Array.from({ length: 5000 }, (_, i) => [i / 5000, i % 2 ? 0 : 40])
  const out = draw.simplify(zigzag, 0.0001)
  assert.ok(out.length > 2 && out.length <= 5000)
  assert.deepEqual(out[0], zigzag[0])
  assert.deepEqual(out.at(-1), zigzag.at(-1))
})

await test('packPoints rounds for the wire without moving the stroke', () => {
  const packed = draw.packPoints([[0.1234567, 10.7], [0.9999, 200.2]], { tolerance: 0 })
  // x is a fraction of the anchor width, so 3dp is sub-pixel on any real
  // screen; y is document pixels, so whole numbers are exact.
  assert.deepEqual(packed, [[0.123, 11], [1, 200]])
})

await test('packPoints caps a pathological path by decimating, not truncating', () => {
  // Losing the END of a stroke is far more visible than losing detail along it.
  const noisy = Array.from({ length: 4000 }, (_, i) => [i / 4000, (i % 7) * 30])
  const packed = draw.packPoints(noisy, { tolerance: 0, max: 100 })
  assert.equal(packed.length, 100)
  assert.deepEqual(packed[0], [0, 0], 'the first point survives')
  assert.deepEqual(packed.at(-1), [draw.packPoints([noisy.at(-1)])[0][0], (3999 % 7) * 30], 'and so does the last')
})

await test('a realistic one-second segment fits comfortably in the payload field', () => {
  // 120Hz of jittery pointer input along a gentle arc.
  const raw = Array.from({ length: 120 }, (_, i) => {
    const t = i / 119
    return [t * 0.6, Math.round(200 + Math.sin(t * Math.PI) * 120 + (i % 3) - 1)]
  })
  const packed = draw.packPoints(raw)
  const bytes = JSON.stringify(packed).length
  assert.ok(packed.length < raw.length, `simplified ${raw.length} -> ${packed.length}`)
  // rooms_events.payload is a json field with maxSize 100000.
  assert.ok(bytes < 4000, `${bytes} bytes is far inside the 100KB payload cap`)
})

// --- graph: deterministic layout and derived relationships -------------------

const DIAGRAM = {
  lanes: [{ id: 'top' }, { id: 'bottom' }],
  nodes: [
    { id: 'a', lane: 'top', column: 1, label: 'A' },
    { id: 'b', lane: 'top', column: 2, label: 'B' },
    { id: 'c', lane: 'bottom', column: 1, label: 'C' },
    { id: 'lonely', lane: 'bottom', column: 2, label: 'Lonely' },
  ],
  edges: [
    { id: 'ab', from: 'a', to: 'b' },
    { id: 'bc', from: 'b', to: 'c' },
    { id: 'side', from: 'c', to: 'lonely' },
  ],
  journeys: [{ id: 'trip', label: 'A trip', edges: ['ab', 'bc'] }],
}

await test('layout is a direct mapping: lanes give y, column gives x', () => {
  const m = graph.layout(DIAGRAM)
  const at = (id) => m.nodes.find((n) => n.id === id)
  assert.equal(at('a').y, at('b').y, 'same lane, same y')
  assert.ok(at('c').y > at('a').y, 'a later lane is lower')
  assert.ok(at('b').x > at('a').x, 'a later column is further right')
  assert.equal(at('a').x, at('c').x, 'the same column aligns across lanes')
})

await test('layout is deterministic: the same data lays out identically', () => {
  // A diagram that rearranges itself between visits cannot be referred to in
  // prose -- which is why there is no force simulation here.
  const a = graph.layout(DIAGRAM)
  const b = graph.layout(DIAGRAM)
  assert.deepEqual(
    a.nodes.map((n) => [n.id, n.x, n.y]),
    b.nodes.map((n) => [n.id, n.x, n.y])
  )
  assert.deepEqual(a.edges.map((e) => e.d), b.edges.map((e) => e.d))
})

await test('a journey names EDGES, so its nodes are derived', () => {
  const m = graph.layout(DIAGRAM)
  const trip = m.journeys[0]
  // Naming nodes as well would let the two disagree; deriving them means
  // adding an edge to a journey updates both for free.
  assert.deepEqual([...trip.nodes].sort(), ['a', 'b', 'c'])
})

await test('nodes no journey touches are derived, never maintained', () => {
  const m = graph.layout(DIAGRAM)
  assert.deepEqual(m.orphans, ['lonely'])

  // Extend the journey to cover it and it stops being an orphan, with nothing
  // else edited.
  const extended = graph.layout({
    ...DIAGRAM,
    journeys: [{ id: 'trip', edges: ['ab', 'bc', 'side'] }],
  })
  assert.deepEqual(extended.orphans, [])
})

await test('an orphan node still has its own edges to fall back on', () => {
  // Without this the widget would dim the whole diagram and highlight nothing,
  // which reads as a bug rather than as an absence of journeys.
  const m = graph.layout(DIAGRAM)
  assert.deepEqual(m.nodeEdges.get('lonely'), ['side'])
  assert.equal(m.nodeJourneys.has('lonely'), false)
})

await test('validate reports author mistakes by id instead of throwing', () => {
  const problems = graph.validate({
    lanes: [{ id: 'top' }],
    nodes: [
      { id: 'a', lane: 'top', column: 1 },
      { id: 'a', lane: 'top', column: 2 },
      { id: 'clash', lane: 'top', column: 2 },
      { id: 'nowhere', lane: 'missing', column: 1 },
    ],
    edges: [{ id: 'e', from: 'a', to: 'ghost' }],
    journeys: [{ id: 'j', edges: ['nope'] }],
  })
  const joined = problems.join(' | ')
  assert.match(joined, /duplicate node id "a"/)
  assert.match(joined, /overlap at lane "top" column 2/, 'two nodes in one slot would draw on top of each other')
  assert.match(joined, /unknown lane "missing"/)
  assert.match(joined, /unknown node "ghost"/)
  assert.match(joined, /journey "j" names unknown edge "nope"/)
})

await test('a journey renders as prose, so the drawing is never the only copy', () => {
  const m = graph.layout({
    ...DIAGRAM,
    edges: [{ id: 'ab', from: 'a', to: 'b', label: 'calls' }, ...DIAGRAM.edges.slice(1)],
  })
  const text = graph.describeJourney(m, m.journeys[0])
  assert.equal(text, 'A → B (calls), then B → C')
})

await test('layout survives dangling references without producing junk geometry', () => {
  const m = graph.layout({
    lanes: [{ id: 'l' }],
    nodes: [{ id: 'a', lane: 'l', column: 1 }, { id: 'x', lane: 'ghost', column: 1 }],
    edges: [{ id: 'ok', from: 'a', to: 'a' }, { id: 'bad', from: 'a', to: 'ghost' }],
    journeys: [{ id: 'j', edges: ['bad', 'ok'] }],
  })
  assert.deepEqual(m.nodes.map((n) => n.id), ['a'], 'a node in an unknown lane is dropped')
  assert.deepEqual(m.edges.map((e) => e.id), ['ok'], 'an edge to nowhere is dropped')
  assert.deepEqual(m.journeys[0].edges, ['ok'], 'and the journey forgets it too')
  assert.ok(m.problems.length, 'but every one of them is reported')
})

// --- widget lifecycle -------------------------------------------------------
//
// Exercised with a stub element rather than jsdom: widget() only touches
// document when the target is a selector string, which is precisely what makes
// it testable here.

const stubEl = () => {
  const listeners = []
  return {
    listeners,
    addEventListener: (type, fn, opts) => listeners.push({ type, fn, opts }),
    removeEventListener: (type, fn) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn)
      if (i >= 0) listeners.splice(i, 1)
    },
  }
}

await test('widget returns a handle carrying element and destroy', () => {
  const el = stubEl()
  const mount = core.widget('probe', () => ({ hello: 1 }))
  const handle = mount(el)
  assert.equal(handle.element, el)
  assert.equal(handle.hello, 1, 'the factory handle is merged through')
  assert.equal(typeof handle.destroy, 'function')
  assert.equal(handle.destroyed, false)
})

await test('destroy removes every listener registered through ctx.on', () => {
  const el = stubEl()
  const mount = core.widget('probe', (ctx, element) => {
    ctx.on(element, 'click', () => {})
    ctx.on(element, 'keydown', () => {})
  })
  const handle = mount(el)
  assert.equal(el.listeners.length, 2)
  handle.destroy()
  assert.equal(el.listeners.length, 0, 'listeners must not outlive the widget')
  assert.equal(handle.destroyed, true)
})

await test('a live value accessor survives the handle wrapper', () => {
  // Regression: the wrapper used to spread the factory's handle, which
  // evaluates getters once and freezes them as plain properties. That silently
  // broke the commonest handle shape there is -- editor.value would have
  // returned its initial text forever.
  const mount = core.widget('probe', () => {
    let v = 'initial'
    return {
      get value() {
        return v
      },
      set value(x) {
        v = String(x)
      },
      setValue(x) {
        v = String(x)
      },
    }
  })
  const handle = mount(stubEl())
  handle.setValue('changed')
  assert.equal(handle.value, 'changed', 'the getter must stay live')
  handle.value = 'assigned'
  assert.equal(handle.value, 'assigned', 'and the setter must survive')
})

await test('element always means the mount target, whatever the factory returns', () => {
  // The contract props are applied last and win. A widget with a second
  // interesting node (preview's popover, nav's bar) must name it something
  // else -- otherwise the override is silent and the handle lies.
  const el = stubEl()
  const decoy = { decoy: true }
  const mount = core.widget('probe', () => ({ element: decoy, destroyed: 'nope' }))
  const handle = mount(el)
  assert.equal(handle.element, el, 'the factory cannot repurpose element')
  assert.equal(handle.destroyed, false, 'nor destroyed')
})

await test('destroy is idempotent', () => {
  let teardowns = 0
  const mount = core.widget('probe', (ctx) => {
    ctx.own(() => teardowns++)
  })
  const handle = mount(stubEl())
  handle.destroy()
  handle.destroy()
  handle.destroy()
  assert.equal(teardowns, 1, 'a second destroy must not tear down twice')
})

await test('teardown runs in reverse order and survives a thrower', () => {
  const order = []
  const mount = core.widget('probe', (ctx) => {
    ctx.own(() => order.push('first'))
    ctx.own(() => {
      throw new Error('boom')
    })
    ctx.own(() => order.push('last'))
  })
  const handle = mount(stubEl())
  assert.doesNotThrow(() => handle.destroy(), 'one bad cleanup must not block the rest')
  assert.deepEqual(order, ['last', 'first'])
})

await test("the widget's own destroy runs before listeners are removed", () => {
  const el = stubEl()
  let sawListeners = -1
  const mount = core.widget('probe', (ctx, element) => {
    ctx.on(element, 'click', () => {})
    return {
      destroy() {
        sawListeners = el.listeners.length
      },
    }
  })
  mount(el).destroy()
  assert.equal(sawListeners, 1, 'a widget may need to emit a final event on teardown')
  assert.equal(el.listeners.length, 0)
})

await test('a factory that throws leaves no listeners behind', () => {
  const el = stubEl()
  const mount = core.widget('probe', (ctx, element) => {
    ctx.on(element, 'click', () => {})
    throw new Error('half-built')
  })
  assert.throws(() => mount(el), /half-built/)
  assert.equal(el.listeners.length, 0, 'a failed mount must clean up after itself')
})

await test('a missing target is a CubbyError, not a TypeError', () => {
  const mount = core.widget('probe', () => ({}))
  assert.throws(() => mount(null), (err) => err instanceof core.CubbyError && err.code === 'bad_request')
  assert.throws(
    () => mount('#nope'),
    (err) => err instanceof core.CubbyError && err.code === 'bad_request',
    'a selector with no DOM is a bad_request'
  )
})

// --- platform sensing -------------------------------------------------------

await test('hasPlatform is false for a core-only namespace', () => {
  const bare = core.attachCore({})
  assert.equal(core.hasPlatform(bare), false)
  assert.equal(bare.hasPlatform(), false)
  assert.equal(core.hasPlatform(platform.default), true, 'the platform namespace reports true')
  assert.equal(platform.default.hasPlatform(), true)
})

await test('attachCore is non-clobbering', () => {
  const ns = { CubbyError: class Impostor {} }
  const before = ns.CubbyError
  core.attachCore(ns)
  assert.equal(ns.CubbyError, before, 'an already-populated namespace is left alone')
  assert.equal(ns.widget, undefined, 'and is not half-populated either')
})

console.log(passed === 0 ? 'no tests ran' : `all ${passed} tests passed`)
