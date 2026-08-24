// Widget DOM tests. Runs the built IIFE bundles inside jsdom, so the thing
// under test is the shipped artifact loaded the way a page loads it.
//
//   npm run build
//   node scripts/widget-tests.mjs
import assert from 'node:assert/strict'
import { page, bundle as bundleSource } from './widget-harness.mjs'

/**
 * Structural compare across the jsdom boundary.
 *
 * Arrays and objects built inside the jsdom realm have a different Array
 * prototype, so assert.deepEqual reports "same structure but not
 * reference-equal" on values that are in fact correct. Round-tripping through
 * JSON drops the realm.
 */
const same = (actual, expected, message) =>
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message)

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

const EDITOR_SCRIPTS = ['core.js', 'markdown.js', 'editor.js']

// --- editor -----------------------------------------------------------------

await test('editor mounts a textarea and renders a preview', () => {
  const p = page({ html: '<div id="host"></div>', scripts: EDITOR_SCRIPTS })
  const ed = p.cubby.editor('#host', { value: '# hi', preview: 'split' })

  assert.deepEqual(p.errors, [], 'mounting must log nothing')
  const textarea = p.document.querySelector('#host textarea')
  assert.ok(textarea, 'a plain textarea, not a contenteditable')
  assert.equal(textarea.value, '# hi')
  assert.match(ed.preview.innerHTML, /<h1>hi<\/h1>/, 'preview renders through cubby.markdown')
  assert.equal(ed.element, p.document.querySelector('#host'))
})

await test('editor.value is a live accessor, not a snapshot', () => {
  // The bug the widget wrapper introduced and the regression this guards.
  const p = page({ html: '<div id="host"></div>', scripts: EDITOR_SCRIPTS })
  const ed = p.cubby.editor('#host', { value: 'first' })

  assert.equal(ed.value, 'first')
  ed.textarea.value = 'typed by the user'
  assert.equal(ed.value, 'typed by the user', 'reads through to the textarea')

  ed.setValue('set programmatically')
  assert.equal(ed.value, 'set programmatically')
  assert.equal(ed.textarea.value, 'set programmatically')

  ed.value = 'assigned'
  assert.equal(ed.value, 'assigned', 'the setter survives the wrapper too')
})

await test('editor preview updates as you type, and only through one renderer', () => {
  const p = page({ html: '<div id="host"></div>', scripts: EDITOR_SCRIPTS })
  const ed = p.cubby.editor('#host', { value: '', preview: 'split', previewDebounceMs: 0 })

  ed.textarea.value = '**bold**'
  ed.refresh()
  assert.match(ed.preview.innerHTML, /<strong>bold<\/strong>/)
  assert.equal(
    ed.preview.innerHTML.trim(),
    p.cubby.markdown.render('**bold**').trim(),
    'the preview is the same renderer the app would use for the saved value'
  )
})

await test('editor escapes on the preview path too', () => {
  const p = page({ html: '<div id="host"></div>', scripts: EDITOR_SCRIPTS })
  const ed = p.cubby.editor('#host', { value: '# <img src=x onerror=alert(1)>', preview: 'split' })
  assert.ok(!ed.preview.querySelector('img'), 'raw HTML must render as visible text')
  assert.match(ed.preview.innerHTML, /&lt;img/)
})

await test('editor.destroy removes markup and listeners', () => {
  const p = page({ html: '<div id="host"></div>', scripts: EDITOR_SCRIPTS })
  const host = p.document.querySelector('#host')
  const ed = p.cubby.editor('#host', { value: 'x' })
  assert.ok(host.querySelector('textarea'))

  ed.destroy()
  assert.equal(host.querySelector('textarea'), null, 'markup is gone')
  assert.equal(ed.destroyed, true)

  ed.destroy()
  assert.equal(ed.destroyed, true, 'and destroy stays idempotent in a real DOM')
})

await test('editor tabs switch between write and preview', () => {
  const p = page({ html: '<div id="host"></div>', scripts: EDITOR_SCRIPTS })
  const ed = p.cubby.editor('#host', { value: '# heading', preview: true })
  const [write, preview] = p.document.querySelectorAll('#host .cubby-md-tab')

  assert.equal(write.getAttribute('aria-selected'), 'true', 'write is selected first')
  assert.equal(ed.preview.hidden, true)

  preview.dispatchEvent(new p.window.Event('click', { bubbles: true }))
  assert.equal(preview.getAttribute('aria-selected'), 'true')
  assert.equal(ed.preview.hidden, false)
  assert.match(ed.preview.innerHTML, /<h1>heading<\/h1>/)

  write.dispatchEvent(new p.window.Event('click', { bubbles: true }))
  assert.equal(ed.textarea.hidden, false)
})

// --- the platform is optional, and silent about it --------------------------

await test('with no platform: preview works, upload unwired, nothing logged', () => {
  const p = page({ html: '<div id="host"></div>', scripts: EDITOR_SCRIPTS })
  assert.equal(p.cubby.hasPlatform(), false)

  const ed = p.cubby.editor('#host', { value: 'note', upload: { pathPrefix: 'uploads/' } })
  assert.deepEqual(p.errors, [], 'absence of a backend is never reported as a failure')
  assert.deepEqual(p.warnings, [])

  // A paste carrying an image must be left completely alone -- no handler, so
  // no preventDefault, so the browser's own paste still happens.
  const paste = new p.window.Event('paste', { bubbles: true, cancelable: true })
  paste.clipboardData = { items: [{ kind: 'file', type: 'image/png', getAsFile: () => ({ name: 'a.png', size: 10, type: 'image/png' }) }] }
  ed.textarea.dispatchEvent(paste)
  assert.equal(paste.defaultPrevented, false, 'no upload handler is attached at all')
  // length, not deepEqual: arrays built inside the jsdom realm have a
  // different Array prototype and fail a strict structural compare.
  assert.equal(ed.images.length, 0)
  assert.deepEqual(p.errors, [])
})

await test('with a platform: an image paste uploads and swaps its placeholder', async () => {
  const uploaded = []
  const p = page({
    html: '<div id="host"></div>',
    scripts: EDITOR_SCRIPTS,
    platform: {
      _pb: {},
      identity: { user: { id: 'u1' } },
      fs: {
        async write(path) {
          uploaded.push(path)
          return { url: `/api/files/${path}` }
        },
      },
    },
  })
  assert.equal(p.cubby.hasPlatform(), true)

  const ed = p.cubby.editor('#host', { value: '', upload: { pathPrefix: 'uploads/' } })
  ed.textarea.setSelectionRange(0, 0)

  const file = { name: 'shot.png', size: 1024, type: 'image/png' }
  const paste = new p.window.Event('paste', { bubbles: true, cancelable: true })
  paste.clipboardData = { items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }] }
  ed.textarea.dispatchEvent(paste)

  assert.equal(paste.defaultPrevented, true, 'an image paste is taken over')
  assert.match(ed.value, /!\[Uploading shot\.png/, 'placeholder goes in at the caret immediately')

  await new Promise((r) => setTimeout(r, 0))

  assert.equal(uploaded.length, 1)
  assert.match(uploaded[0], /^uploads\/u1\/[a-z0-9]+\.png$/, 'server-side naming, so two image.png pastes cannot collide')
  assert.ok(!ed.value.includes('Uploading'), 'placeholder was swapped out')
  assert.match(ed.value, /!\[shot\.png\]\(\/api\/files\/uploads\/u1\/.*\.png\)/)
  assert.equal(ed.images.length, 1, 'and the handle records it')
})

await test('a paste with no image is left entirely alone', () => {
  const p = page({
    html: '<div id="host"></div>',
    scripts: EDITOR_SCRIPTS,
    platform: { _pb: {}, identity: { user: { id: 'u1' } }, fs: { async write() { return {} } } },
  })
  const ed = p.cubby.editor('#host', { value: '' })

  const paste = new p.window.Event('paste', { bubbles: true, cancelable: true })
  paste.clipboardData = { items: [{ kind: 'string', type: 'text/plain' }] }
  ed.textarea.dispatchEvent(paste)

  assert.equal(paste.defaultPrevented, false, 'getting this backwards breaks every normal paste')
  assert.equal(ed.value, '')
})

// --- nav ---------------------------------------------------------------------

const NAV_SCRIPTS = ['core.js', 'nav.js']
const NAV_PAGE = `
  <div id="bar"></div>
  <main>
    <section aria-labelledby="intro"><h2 id="intro">Introduction</h2></section>
    <section aria-labelledby="usage"><h2 id="usage">Usage</h2></section>
    <section aria-labelledby="long" data-nav-label="Short"><h2 id="long">An extremely long heading</h2></section>
    <section><h2>Not opted in</h2></section>
    <section aria-labelledby="hid" hidden><h2 id="hid">Hidden</h2></section>
    <section aria-labelledby="dangling"><h2>heading id does not exist</h2></section>
  </main>`

const mountNav = (opts = {}, pageOpts = {}) => {
  const p = page({ html: NAV_PAGE, scripts: NAV_SCRIPTS, ...pageOpts })
  return { p, nav: p.cubby.nav('#bar', opts) }
}

await test('nav derives row two from aria-labelledby, not from a declaration', () => {
  const { p, nav } = mountNav()
  assert.deepEqual(p.errors, [])
  const labels = [...p.document.querySelectorAll('.cubby-nav-sections .cubby-nav-pill')].map(
    (a) => a.textContent
  )
  // Opted-in and visible only. "Not opted in" has no aria-labelledby, "Hidden"
  // is hidden, and the last section points at an id that does not exist -- an
  // entry that scrolled nowhere would read as a broken bar.
  assert.deepEqual(labels, ['Introduction', 'Usage', 'Short'])

  const hrefs = [...p.document.querySelectorAll('.cubby-nav-sections .cubby-nav-pill')].map((a) =>
    a.getAttribute('href')
  )
  assert.deepEqual(hrefs, ['#intro', '#usage', '#long'], 'the heading id IS the jump target')
})

await test('data-nav-label overrides a heading too long for the bar', () => {
  const { p } = mountNav()
  const pill = [...p.document.querySelectorAll('.cubby-nav-sections .cubby-nav-pill')].find(
    (a) => a.getAttribute('href') === '#long'
  )
  assert.equal(pill.textContent, 'Short')
})

await test('the active section never clears when nothing is in the band', () => {
  const { p, nav } = mountNav()
  const observer = p.window.__observers.at(-1)
  const section = (id) => p.document.querySelector(`[aria-labelledby="${id}"]`)
  const activeHref = () =>
    p.document.querySelector('.cubby-nav-sections .cubby-nav-pill[aria-current]')?.getAttribute('href')

  observer.fire([{ target: section('intro'), isIntersecting: true }])
  assert.equal(activeHref(), '#intro')

  observer.fire([{ target: section('usage'), isIntersecting: true }])
  assert.equal(activeHref(), '#usage')

  // Mid-section on a tall block: everything reports NOT intersecting. The last
  // answer standing must survive -- clearing here makes the highlight flicker
  // off, which reads as a bug.
  observer.fire([
    { target: section('intro'), isIntersecting: false },
    { target: section('usage'), isIntersecting: false },
  ])
  assert.equal(activeHref(), '#usage', 'the highlight must not flicker off')
  assert.equal(nav.current().section, 'usage')
})

await test('nav publishes its measured height as a custom property', () => {
  const { p, nav } = mountNav()
  const prop = p.document.documentElement.style.getPropertyValue('--cubby-nav-height')
  assert.match(prop, /^\d+px$/, 'one measurement, published for everything else to read')
  assert.equal(typeof nav.height(), 'number')

  nav.destroy()
  assert.equal(
    p.document.documentElement.style.getPropertyValue('--cubby-nav-height'),
    '',
    'and removed on destroy'
  )
})

await test('the scrolling row can shrink; the action area cannot', () => {
  const { p } = mountNav()
  const css = [...p.document.head.querySelectorAll('style[data-cubby-nav]')].map((s) => s.textContent).join('')
  // Flex items default to min-width:auto and refuse to size below their
  // content, which shoves the action area off the right edge of a narrow
  // window instead of scrolling the pills.
  assert.match(css, /\.cubby-nav-scroll\s*\{[^}]*min-width:\s*0/, 'the pill row must be allowed to shrink')
  assert.match(css, /\.cubby-nav-actions\s*\{[^}]*flex:\s*none/, 'the action area must not')
})

await test('nav exposes its action area for other widgets to mount into', () => {
  const { p, nav } = mountNav()
  const { actions } = nav.current()
  assert.ok(actions, 'a widget can find where to put its trigger without being told')
  assert.equal(actions.className, 'cubby-nav-actions')

  const css = [...p.document.head.querySelectorAll('style[data-cubby-nav]')].map((s) => s.textContent).join('')
  // Naming a consumer by class here would make the bar know about widgets
  // that have not been written yet.
  assert.match(css, /\.cubby-nav-actions > \*/, 'the slot styles its children generically')
})

await test('refresh() picks up sections rendered after load', () => {
  const { p, nav } = mountNav()
  const count = () => p.document.querySelectorAll('.cubby-nav-sections .cubby-nav-pill').length
  assert.equal(count(), 3)

  const extra = p.document.createElement('section')
  extra.setAttribute('aria-labelledby', 'later')
  extra.innerHTML = '<h2 id="later">Rendered later</h2>'
  p.document.querySelector('main').appendChild(extra)
  assert.equal(count(), 3, 'not until told')

  nav.refresh()
  assert.equal(count(), 4)
  assert.equal(p.window.__observers.at(-1).observed.size, 4, 'and the new one is observed')
})

await test('the current page pill matches by directory, / and /index.html alike', () => {
  const pages = [
    { href: '/', label: 'Home' },
    { href: '/docs/', label: 'Docs' },
    { href: '/hello/', label: 'Hello' },
  ]
  const currentOf = (url) => {
    const p = page({ html: NAV_PAGE, scripts: NAV_SCRIPTS, url })
    p.cubby.nav('#bar', { pages })
    return p.document.querySelector('.cubby-nav-pages .cubby-nav-pill[aria-current]')?.textContent
  }
  assert.equal(currentOf('https://cubby.test/docs/'), 'Docs')
  assert.equal(currentOf('https://cubby.test/docs/index.html'), 'Docs', 'a nested index is the same page')
  assert.equal(currentOf('https://cubby.test/'), 'Home')
  assert.equal(currentOf('https://cubby.test/index.html'), 'Home', 'and so is the root one')
  assert.equal(currentOf('https://cubby.test/other/'), undefined, 'no false positives')
})

await test('nav leaks exactly two global rules, and offers an opt-out', () => {
  const { p } = mountNav()
  const global = p.document.querySelector('style[data-cubby-nav-global]')
  assert.ok(global, 'a sticky bar that sets no scroll-margin buries every anchor jump')
  // The offset is read from the property the bar publishes, so it cannot
  // disagree with the bar's real height.
  assert.match(global.textContent, /scroll-margin-top:\s*calc\(var\(--cubby-nav-height/)
  assert.match(global.textContent, /prefers-reduced-motion: no-preference/)

  const opted = mountNav({ globalRules: false })
  assert.equal(
    opted.p.document.querySelector('style[data-cubby-nav-global]'),
    null,
    'a host that wants to own them can say so'
  )
})

await test('nav.destroy leaves the page as it found it', () => {
  const { p, nav } = mountNav()
  const observer = p.window.__observers.at(-1)
  nav.destroy()
  assert.equal(p.document.querySelector('.cubby-nav'), null)
  assert.equal(observer.disconnected, true, 'the observer must not outlive the bar')
  assert.equal(nav.destroyed, true)
})

// --- preview -----------------------------------------------------------------

const PREVIEW_SCRIPTS = ['core.js', 'preview.js']
const PREVIEW_PAGE = `
  <main>
    <a id="own" href="/hello/">Hello app</a>
    <a id="allowed" href="https://example.com/page">Allowed</a>
    <a id="blocked" href="https://blocked.test/page" data-preview-description="A described page">Blocked</a>
    <a id="scheme" href="javascript:alert(1)">Bad scheme</a>
  </main>`

const tick = () => new Promise((r) => setTimeout(r, 0))

function mountPreview(opts = {}) {
  const p = page({ html: PREVIEW_PAGE, scripts: PREVIEW_SCRIPTS })
  const pv = p.cubby.preview('main', { delay: 1, hideDelay: 5, allow: ['example.com'], ...opts })
  const fire = (id, type) => {
    const el = p.document.getElementById(id)
    el.dispatchEvent(new p.window.Event(type, { bubbles: true }))
    return el
  }
  return { p, pv, fire, pop: pv.popover }
}

await test('preview frames an allowlisted page and sets src only after layout', async () => {
  const { p, fire, pop } = mountPreview()
  fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))

  assert.deepEqual(p.errors, [])
  const frame = pop.querySelector('iframe')
  assert.ok(frame, 'an allowlisted host gets a real frame')
  assert.equal(frame.getAttribute('src'), 'https://example.com/page')
  assert.equal(pop.hidden, false, 'the popover was laid out before src went on')
  assert.equal(pop.querySelector('.cubby-preview-open').getAttribute('href'), 'https://example.com/page')
})

await test('a refused host renders a card naming it, never a blank box', async () => {
  const { fire, pop } = mountPreview()
  fire('blocked', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))

  assert.equal(pop.querySelector('iframe'), null, 'no frame for an unmeasured host')
  assert.ok(pop.querySelector('.cubby-preview-open'), 'but still an Open link')
  assert.match(pop.querySelector('.cubby-preview-description').textContent, /A described page/)
  // Rendering nothing would read as a broken feature rather than a page that
  // will not embed.
  assert.match(pop.querySelector('.cubby-preview-note').textContent, /blocked\.test does not allow embedding/)
})

await test('a refused scheme gets the card with no live link', async () => {
  const { fire, pop } = mountPreview()
  fire('scheme', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(pop.querySelector('iframe'), null)
  assert.equal(pop.querySelector('.cubby-preview-open'), null, 'nothing clickable for javascript:')
  assert.match(pop.querySelector('.cubby-preview-note').textContent, /cannot be previewed/)
})

await test('the frame is sandboxed, and never scripts+same-origin together', async () => {
  const strict = mountPreview()
  strict.fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(strict.pop.querySelector('iframe').getAttribute('sandbox'), '', 'sandbox="" by default')

  const scripted = mountPreview({ scripts: true })
  scripted.fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))
  const sandbox = scripted.pop.querySelector('iframe').getAttribute('sandbox')
  assert.equal(sandbox, 'allow-scripts')
  // The pair lets a same-origin framed document remove its own sandbox.
  assert.ok(!sandbox.includes('allow-same-origin'), 'never pair these two')
})

await test('the iframe carries no error listener, only a timeout path', () => {
  // A blocked frame fires no error event and load may still run on the blocked
  // shell, so an error listener would be dead code that implies a fallback
  // exists. Assert the source never adds one.
  const js = bundleSource('preview.js')
  assert.ok(!/addEventListener\("error"/.test(js), 'no error listener on the frame')
  assert.ok(/addEventListener\("load"/.test(js), 'load is the only listener')
})

await test('one shared timer: entering the popover cancels the pending close', async () => {
  const { p, fire, pop } = mountPreview({ hideDelay: 30 })
  fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(pop.hidden, false)

  fire('allowed', 'mouseout')                       // schedules the hide
  pop.dispatchEvent(new p.window.Event('mouseenter')) // must clear THAT timer
  await new Promise((r) => setTimeout(r, 60))

  // If these were two separate timers nothing would cancel the close, and the
  // Open link would be unreachable however fast you moved.
  assert.equal(pop.hidden, false, 'the popover must survive the trip to the Open link')
})

await test('a stale close cannot kill a popover that has since opened elsewhere', async () => {
  const { fire, pop } = mountPreview({ hideDelay: 30 })
  fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))

  fire('allowed', 'mouseout')          // schedules a hide owned by #allowed
  fire('blocked', 'mouseover')         // takes ownership
  await new Promise((r) => setTimeout(r, 60))

  assert.equal(pop.hidden, false, 'the guarded close must not fire for a former owner')
  assert.match(pop.querySelector('.cubby-preview-note').textContent, /blocked\.test/)
})

await test('hide() empties the popover, tearing the framed document down', async () => {
  const { pv, fire, pop } = mountPreview({ unloadDelay: 5 })
  fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))
  assert.ok(pop.querySelector('iframe'))

  pv.hide()
  await new Promise((r) => setTimeout(r, 30))
  // Merely hiding would leave a few hundred documents loaded on a page with a
  // few hundred links.
  assert.equal(pop.children.length, 0, 'the frame must actually be torn down')
})

await test('Escape and scroll dismiss; a scroll inside the popover does not', async () => {
  const { p, pv, fire, pop } = mountPreview()

  fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))
  p.document.dispatchEvent(new p.window.Event('keydown', { bubbles: true }))
  assert.equal(pop.hidden, false, 'a non-Escape key changes nothing')

  const esc = new p.window.Event('keydown', { bubbles: true })
  esc.key = 'Escape'
  p.document.dispatchEvent(esc)
  assert.equal(pop.hidden, true)

  fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))
  // Scrolling the description card must not dismiss the thing being read.
  pop.dispatchEvent(new p.window.Event('scroll', { bubbles: true }))
  assert.equal(pop.hidden, false, 'a scroll originating inside is exempt')

  p.document.dispatchEvent(new p.window.Event('scroll', { bubbles: true }))
  assert.equal(pop.hidden, true, 'a scroll anywhere else dismisses')
})

await test('a scroll from window does not throw on the contains() guard', async () => {
  const { p, fire, pop } = mountPreview()
  fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))
  // Node.contains() throws a TypeError on anything that is not a Node, and
  // window is a legitimate scroll target.
  assert.doesNotThrow(() => p.window.dispatchEvent(new p.window.Event('scroll', { bubbles: true })))
  assert.deepEqual(p.errors, [])
})

await test('the dwell delay applies to focus as well as hover', async () => {
  const { p, pop } = mountPreview({ delay: 40 })
  const el = p.document.getElementById('allowed')
  el.dispatchEvent(new p.window.Event('focusin', { bubbles: true }))
  // Opening instantly on focus fires a document load at every tab stop
  // through a list.
  assert.equal(pop.hidden, true, 'not opened yet')
  await new Promise((r) => setTimeout(r, 70))
  assert.equal(pop.hidden, false)
})

await test('preview is suppressed on hover-less and narrow viewports', () => {
  const { p } = mountPreview()
  const css = [...p.document.head.querySelectorAll('style[data-cubby-preview]')]
    .map((s) => s.textContent)
    .join('')
  // A tap on a wide touch device can move focus and open a popover with no
  // pointer to dismiss it.
  assert.match(css, /@media \(hover: none\), \(max-width: 40rem\)/)
})

await test('preview classes are prefixed so they cannot restyle a host', () => {
  const { p } = mountPreview()
  const css = [...p.document.head.querySelectorAll('style[data-cubby-preview]')]
    .map((s) => s.textContent)
    .join('')
  const classes = [...css.matchAll(/\.([a-z][a-z0-9-]*)/g)].map((m) => m[1])
  const unprefixed = [...new Set(classes)].filter((c) => !c.startsWith('cubby-preview'))
  assert.deepEqual(unprefixed, [], `a generic class would restyle a host page: ${unprefixed}`)
})

await test('attach() wires a link outside the root and returns a disposer', async () => {
  const { p, pv, pop } = mountPreview()
  const outside = p.document.createElement('a')
  outside.href = 'https://example.com/other'
  outside.textContent = 'Outside'
  p.document.body.appendChild(outside)

  // Attached triggers take mouseenter/mouseleave, which do NOT bubble --
  // the opposite of the delegated pair.
  const dispose = pv.attach(outside)
  outside.dispatchEvent(new p.window.Event('mouseenter'))
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(pop.hidden, false)
  pv.hide()

  dispose()
  outside.dispatchEvent(new p.window.Event('mouseenter'))
  await new Promise((r) => setTimeout(r, 20))
  assert.equal(pop.hidden, true, 'the disposer really detaches')
})

await test('preview.destroy removes the popover and its listeners', async () => {
  const { p, pv, fire, pop } = mountPreview()
  fire('allowed', 'mouseover')
  await new Promise((r) => setTimeout(r, 20))

  pv.destroy()
  assert.equal(pop.isConnected, false)
  assert.equal(p.document.querySelector('.cubby-preview'), null)
})

// --- draw --------------------------------------------------------------------

const DRAW_SCRIPTS = ['core.js', 'draw.js']

/** A rooms stub that records what was emitted and lets a test inject peers. */
function drawRoom() {
  const handlers = new Map()
  const api = {
    id: 'test/draw',
    emitted: [],
    states: [],
    users: [{ user: { id: 'me' } }],
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event).add(fn)
    },
    async emit(event, payload) {
      api.emitted.push({ event, payload })
    },
    async updateUserState(patch) {
      api.states.push(patch)
    },
    async join() {},
    async leave() {},
    /** Deliver an inbound event the way the SSE subscription would. */
    fire(event, ...args) {
      for (const fn of handlers.get(event) || []) fn(...args)
    },
  }
  return api
}

function mountDraw(opts = {}, { userId = 'me' } = {}) {
  const room = drawRoom()
  const p = page({
    html: '<main id="anchor" style="width:1000px"></main>',
    scripts: DRAW_SCRIPTS,
    platform: {
      _pb: {},
      ready: Promise.resolve(),
      identity: { user: userId ? { id: userId } : null },
      fs: {},
      rooms: { room: () => room },
    },
  })
  // The anchor has no layout in jsdom, so pin a frame the coordinate maths
  // can use: x is a fraction of this width, y is document px from this top.
  const anchor = p.document.getElementById('anchor')
  anchor.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500 })
  const handle = p.cubby.draw('#anchor', { segmentMs: 10_000, chip: true, ...opts })
  return { p, room, handle, anchor }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

/** Hold the modifier, drag through a few points, release. */
function scribble(p, points, { release = true, buttons = 1 } = {}) {
  const win = p.window
  const ev = (type, x, y, extra = {}) => {
    const e = new win.Event(type, { bubbles: true, cancelable: true })
    Object.assign(e, { pageX: x, pageY: y, altKey: true, buttons, ...extra })
    win.dispatchEvent(e)
    return e
  }
  ev('pointermove', points[0][0], points[0][1])
  ev('pointerdown', points[0][0], points[0][1])
  for (const [x, y] of points.slice(1)) ev('pointermove', x, y)
  if (release) ev('pointerup', points.at(-1)[0], points.at(-1)[1])
  return ev
}

await test('draw mounts silently and shows no remote cursors by default', async () => {
  const { p, room } = mountDraw()
  await settle()
  assert.deepEqual(p.errors, [])
  assert.ok(p.document.querySelector('svg.cubby-draw-marks'))
  assert.ok(p.document.querySelector('.cubby-draw-cursors'))
  // cursors: false by default -- every remote cursor sample is a presence
  // write and an SSE fan-out, so it has to be asked for.
  assert.equal(room.states.length, 0, 'no cursor state written without opting in')
})

await test('holding the modifier shows the local puck even with no peers', async () => {
  const { p } = mountDraw()
  await settle()
  const e = new p.window.Event('pointermove', { bubbles: true })
  Object.assign(e, { pageX: 100, pageY: 50, altKey: true, buttons: 0 })
  p.window.dispatchEvent(e)

  const puck = p.document.querySelector('.cubby-draw-puck')
  assert.ok(puck, 'the local puck is always available, shared or not')
  assert.equal(puck.getAttribute('data-self'), '', 'and never eases -- it is your own pointer')
  assert.equal(p.document.body.classList.contains('cubby-draw-held'), true, 'native cursor hidden')
})

await test('a stroke renders locally and emits exactly one event on release', async () => {
  const { p, room } = mountDraw()
  await settle()
  scribble(p, [[100, 40], [200, 80], [300, 40], [400, 90]])

  const path = p.document.querySelector('path.cubby-draw-path')
  assert.ok(path, 'rendered from our own pointer, not from the echo')
  assert.ok(path.getAttribute('d').startsWith('M'), 'and it has real geometry')

  assert.equal(room.emitted.length, 1, 'one whole path, not one event per point')
  const { event, payload } = room.emitted[0]
  assert.equal(event, 'draw.mark')
  assert.ok(payload.p.length >= 2)
  assert.equal(typeof payload.ms, 'number', 'carries its duration so replay eases at the real speed')
  assert.equal(payload.s, 1, 'session ordinal')
  assert.equal(payload.k, 1, 'stroke ordinal')
})

await test('coordinates are anchor-relative, not raw page pixels', async () => {
  const { p, room } = mountDraw()
  await settle()
  scribble(p, [[0, 40], [500, 40], [1000, 40]])
  const { p: pts } = room.emitted[0].payload
  // x is a fraction of the anchor's 1000px width; y is document pixels.
  same(pts[0], [0, 40])
  same(pts.at(-1), [1, 40])
})

await test('a long stroke flushes time-boxed segments that stitch together', async () => {
  const { p, room } = mountDraw({ segmentMs: 20 })
  await settle()
  const ev = scribble(p, [[100, 40], [200, 80]], { release: false })
  await new Promise((r) => setTimeout(r, 40))
  assert.equal(room.emitted.length, 1, 'flushed mid-stroke without waiting for release')

  ev('pointermove', 300, 120)
  ev('pointermove', 400, 160)
  ev('pointerup', 400, 160)
  assert.ok(room.emitted.length >= 2, 'and again on release')

  const [first, second] = room.emitted
  // The last point of a segment is carried into the next so the two join.
  same(second.payload.p[0], JSON.parse(JSON.stringify(first.payload.p.at(-1))))
  assert.equal(second.payload.q, first.payload.q + 1, 'sequence continues')
})

await test('inbound marks from a peer render; our own echo is dropped', async () => {
  const { p, room } = mountDraw()
  await settle()
  const count = () => p.document.querySelectorAll('path.cubby-draw-path').length

  // cubby.rooms echoes every emit back to its sender. Rendering the echo as
  // well as our own pointer would double every local stroke.
  room.fire('draw.mark', { s: 1, k: 1, q: 0, p: [[0.1, 10], [0.2, 20]], ms: 50 }, { id: 'me' })
  assert.equal(count(), 0, 'our own echo must never be rendered')

  room.fire('draw.mark', { s: 1, k: 1, q: 0, p: [[0.3, 30], [0.4, 40]], ms: 50 }, { id: 'peer' })
  assert.equal(count(), 1, "but a peer's mark is")
})

await test('marks arriving before our identity is known are dropped', async () => {
  // Until our own id is known we cannot tell our echo from anyone else's, so
  // everything before that point has to go.
  const { p, room } = mountDraw({}, { userId: null })
  await settle()
  room.fire('draw.mark', { s: 1, k: 1, q: 0, p: [[0.1, 10], [0.2, 20]], ms: 50 }, { id: 'peer' })
  assert.equal(p.document.querySelectorAll('path.cubby-draw-path').length, 0)
})

await test("a peer's whole hold fades as one group, not stroke by stroke", async () => {
  const { p, room } = mountDraw()
  await settle()
  // Two strokes inside one modifier-hold (same session ordinal).
  room.fire('draw.mark', { s: 4, k: 1, q: 0, p: [[0.1, 10], [0.2, 20]], ms: 10 }, { id: 'peer' })
  room.fire('draw.mark', { s: 4, k: 2, q: 0, p: [[0.3, 30], [0.4, 40]], ms: 10 }, { id: 'peer' })
  assert.equal(p.document.querySelectorAll('path.cubby-draw-path').length, 1, 'one group')

  room.fire('draw.mark', { s: 5, k: 1, q: 0, p: [[0.5, 50], [0.6, 60]], ms: 10 }, { id: 'peer' })
  assert.equal(p.document.querySelectorAll('path.cubby-draw-path').length, 2, 'a new hold is a new group')
})

await test('marks fade and are removed; nothing can freeze on the page', async () => {
  const { p, room } = mountDraw({ fadeMs: 15 })
  await settle()
  room.fire('draw.mark', { s: 1, k: 1, q: 0, p: [[0.1, 10], [0.2, 20]], ms: 1 }, { id: 'peer' })
  assert.equal(p.document.querySelectorAll('path.cubby-draw-path').length, 1)

  // The fade timer is refreshed by activity rather than started by an end
  // event, so a lost final segment cannot strand a mark forever.
  await new Promise((r) => setTimeout(r, 90))
  assert.equal(p.document.querySelectorAll('path.cubby-draw-path').length, 0)
})

await test('all four resets exit, and each one flushes the stroke in flight', async () => {
  const cases = [
    ['keyup', (p) => p.window.dispatchEvent(new p.window.Event('keyup', { bubbles: true }))],
    ['blur', (p) => p.window.dispatchEvent(new p.window.Event('blur'))],
    [
      'visibilitychange',
      (p) => {
        Object.defineProperty(p.document, 'hidden', { value: true, configurable: true })
        p.document.dispatchEvent(new p.window.Event('visibilitychange', { bubbles: true }))
      },
    ],
    [
      'pointermove with the modifier up',
      (p) => {
        const e = new p.window.Event('pointermove', { bubbles: true })
        Object.assign(e, { pageX: 500, pageY: 90, altKey: false, buttons: 0 })
        p.window.dispatchEvent(e)
      },
    ],
  ]
  for (const [name, reset] of cases) {
    const { p, room } = mountDraw({ segmentMs: 10_000 })
    await settle()
    scribble(p, [[100, 40], [200, 80], [300, 40]], { release: false })
    assert.equal(room.emitted.length, 0, `${name}: nothing flushed yet`)

    reset(p)
    // The modifier's keyup is not reliable -- Alt-Tab, blur, tab switch and
    // OS-level grabs all swallow it, and a latched modifier silently eats
    // every later click on the host page.
    assert.equal(p.document.body.classList.contains('cubby-draw-held'), false, `${name}: unlatched`)
    assert.equal(room.emitted.length, 1, `${name}: flushed the stroke in flight`)
    assert.equal(p.document.querySelector('.cubby-draw-puck'), null, `${name}: puck dropped`)
  }
})

await test('a pointermove with buttons === 0 ends the stroke rather than latching', async () => {
  const { p, room } = mountDraw({ segmentMs: 10_000 })
  await settle()
  const ev = scribble(p, [[100, 40], [200, 80]], { release: false })
  // A pointerdown with no matching pointerup -- pointer leaving the window
  // mid-drag, a dropped capture, a synthetic event -- would otherwise latch
  // drag mode and pan every later move into the drawing.
  ev('pointermove', 300, 120, { buttons: 0 })
  assert.equal(room.emitted.length, 1, 'the stroke was ended, not continued')
})

await test('the modifier keydown is never preventDefault-ed', async () => {
  const { p } = mountDraw()
  await settle()
  const e = new p.window.Event('keydown', { bubbles: true, cancelable: true })
  Object.assign(e, { key: 'Alt', altKey: true })
  p.window.dispatchEvent(e)
  // Alt+arrow is text navigation, Alt+letter is how special characters are
  // typed, and screen readers use it as a modifier.
  assert.equal(e.defaultPrevented, false)
})

await test('a modifier-click is swallowed so it cannot follow a link or pan a diagram', async () => {
  const { p } = mountDraw()
  await settle()
  const click = new p.window.Event('click', { bubbles: true, cancelable: true })
  Object.assign(click, { altKey: true })
  p.window.dispatchEvent(click)
  assert.equal(click.defaultPrevented, true)
})

await test('marks sit below a sticky bar and cursors above it', () => {
  const { p } = mountDraw()
  const css = [...p.document.head.querySelectorAll('style[data-cubby-draw]')]
    .map((s) => s.textContent)
    .join('')
  const z = (cls) => Number(css.match(new RegExp(`\\.${cls}\\s*\\{\\s*z-index:\\s*(\\d+)`))?.[1])
  // A mark drawn near the top should slide UNDER the bar like the content it
  // was drawn on; a peer pointing AT a nav link is the one case the puck wins.
  assert.ok(z('cubby-draw-marks') < 40, 'marks below the nav bar')
  assert.ok(z('cubby-draw-cursors') > 40, 'cursors above it')
  // Both overlays cover the page and would otherwise eat every click on it.
  assert.match(css, /pointer-events:\s*none/)
})

await test('the presence chip never claims what it has not established', async () => {
  const { p, room } = mountDraw({}, { userId: null })
  const said = () => p.document.querySelector('.cubby-draw-said').textContent
  // Signed out: a hint, and no count. "Just you" is a claim.
  await settle()
  assert.match(said(), /Hold/)
  assert.doesNotMatch(said(), /Just you/)

  const joined = mountDraw()
  await settle()
  assert.match(joined.p.document.querySelector('.cubby-draw-said').textContent, /Just you/)

  joined.room.users = [{ user: { id: 'me' } }, { user: { id: 'peer' } }]
  joined.room.fire('room.sync')
  assert.match(joined.p.document.querySelector('.cubby-draw-said').textContent, /1 other here/)
})

await test('opting in to shared cursors starts writing presence state', async () => {
  const { p, room } = mountDraw({ cursors: true, cursorMs: 0 })
  await settle()
  const e = new p.window.Event('pointermove', { bubbles: true })
  Object.assign(e, { pageX: 250, pageY: 60, altKey: true, buttons: 0 })
  p.window.dispatchEvent(e)
  assert.ok(room.states.length >= 1, 'now it broadcasts')
  same(room.states[0].at, [0.25, 60], 'anchor-relative, like the marks')
})

await test('draw.destroy unlatches, leaves the room and removes both layers', async () => {
  const { p, handle } = mountDraw()
  await settle()
  scribble(p, [[100, 40], [200, 80]], { release: false })
  handle.destroy()

  assert.equal(p.document.body.classList.contains('cubby-draw-held'), false, 'never leave it latched')
  assert.equal(p.document.querySelector('.cubby-draw-marks'), null)
  assert.equal(p.document.querySelector('.cubby-draw-cursors'), null)
  assert.equal(p.document.querySelector('.cubby-draw-chip'), null)
})

// --- style injection --------------------------------------------------------

await test('injected styles are PREPENDED so the host stylesheet still wins', () => {
  const p = page({
    html: '<div id="host"></div>',
    scripts: EDITOR_SCRIPTS,
  })
  const hostSheet = p.document.createElement('style')
  hostSheet.id = 'host-sheet'
  p.document.head.appendChild(hostSheet)

  p.cubby.editor('#host', { value: 'x' })

  const children = [...p.document.head.children]
  const injected = children.filter((el) => [...el.attributes].some((a) => a.name.startsWith('data-cubby-')))
  assert.ok(injected.length >= 2, 'tokens and markdown sheets both went in')
  for (const el of injected) {
    assert.ok(
      children.indexOf(el) < children.indexOf(hostSheet),
      `${el.attributes[0].name} must come BEFORE the host's own stylesheet`
    )
  }
})

await test('tokens are not injected when the page already links them', () => {
  const p = page({ scripts: EDITOR_SCRIPTS })
  const link = p.document.createElement('link')
  link.setAttribute('rel', 'stylesheet')
  link.setAttribute('href', '/css/tokens.css')
  link.setAttribute('data-cubby-tokens', '')
  p.document.head.appendChild(link)

  p.cubby.markdown.injectStyles()
  assert.equal(
    p.document.querySelectorAll('style[data-cubby-tokens]').length,
    0,
    'a page that links tokens.css must not also get an injected copy'
  )
})

console.log(passed === 0 ? 'no tests ran' : `all ${passed} tests passed`)
