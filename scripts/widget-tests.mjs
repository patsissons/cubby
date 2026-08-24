// Widget DOM tests. Runs the built IIFE bundles inside jsdom, so the thing
// under test is the shipped artifact loaded the way a page loads it.
//
//   npm run build
//   node scripts/widget-tests.mjs
import assert from 'node:assert/strict'
import { page, bundle as bundleSource } from './widget-harness.mjs'

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
