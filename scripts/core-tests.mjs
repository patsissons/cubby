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
    (err) => err instanceof core.CubbyError && err.code === 'bad_request',
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
  assert.throws(
    () => cubby.markdown.editor('#x'),
    (err) => err instanceof cubby.CubbyError && err.code === 'bad_request'
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
