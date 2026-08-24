// Widget DOM tests. Runs the built IIFE bundles inside jsdom, so the thing
// under test is the shipped artifact loaded the way a page loads it.
//
//   npm run build
//   node scripts/widget-tests.mjs
import assert from 'node:assert/strict'
import { page } from './widget-harness.mjs'

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
