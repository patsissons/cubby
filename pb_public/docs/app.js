// Docs app: the sticky site bar, the request-flow diagram, shared scribbling,
// copy buttons on code blocks, and a live footer proving the page is itself a
// cubby app.
/* global cubby */

// The sticky site bar. Row two is derived from the DOM: each <section> carries
// aria-labelledby pointing at its own heading id, so a nav entry for a section
// that no longer exists is unrepresentable rather than merely unlikely. This
// replaces a hand-written <nav id="toc"> plus a hand-rolled IntersectionObserver.
function wireNav() {
  if (!cubby.nav) return
  cubby.nav('#sitebar', {
    label: 'Cubby',
    pages: [
      { href: '/', label: '\u{1F573}\uFE0F cubby' },
      { href: '/docs/', label: 'Docs' },
      { href: '/hello/', label: 'Hello' },
    ],
  })
}

// The request-flow diagram. Declarative: lanes give y, column gives x, and
// journeys name EDGES, so which nodes a journey touches -- and which nodes no
// journey touches at all -- are derived rather than maintained.
function wireDiagram() {
  if (!cubby.graph) return
  cubby.graph('#flow-diagram', {
    label: 'How a request flows through cubby',
    kinds: {
      http: { hue: 205, dash: '' },
      call: { hue: 265, dash: '2 4' },
      data: { hue: 145, dash: '7 4' },
      sse: { hue: 25, dash: '1 5' },
    },
    lanes: [
      { id: 'browser', label: 'Browser' },
      { id: 'instance', label: 'PocketHost instance' },
      { id: 'data', label: 'Data and providers' },
    ],
    nodes: [
      { id: 'app', lane: 'browser', column: 1, label: 'your app.js', note: 'Plain html/js/css. No build step.' },
      { id: 'core', lane: 'browser', column: 2, label: 'core.js', note: 'Namespace, errors, escaping, widget lifecycle, tokens. **No PocketBase.**' },
      { id: 'platform', lane: 'browser', column: 3, label: 'platform.js', note: 'One shared PocketBase client behind `db`, `fs`, `ai`, `rooms`, `identity`.' },
      { id: 'static', lane: 'instance', column: 1, label: 'pb_public', note: 'Static files, CDN-cached per URL for ~4h. Asset refs carry content hashes.' },
      { id: 'api', lane: 'instance', column: 2, label: 'PocketBase API', note: 'REST plus a realtime SSE stream.' },
      { id: 'hooks', lane: 'instance', column: 3, label: 'pb_hooks', note: 'Server-side JS: the AI proxy and the rooms sweeper.' },
      { id: 'collections', lane: 'data', column: 1, label: 'collections', note: 'Per-app tables, namespaced `<app>_<name>`.' },
      { id: 'files', lane: 'data', column: 2, label: 'file storage', note: 'The `files` collection, one row per path.' },
      { id: 'provider', lane: 'data', column: 3, label: 'AI provider', note: 'Never called from the browser: keys stay on the instance.' },
    ],
    edges: [
      { id: 'serve', from: 'static', to: 'app', kind: 'http', label: 'html + bundles' },
      { id: 'boot', from: 'app', to: 'core', kind: 'call' },
      { id: 'use', from: 'core', to: 'platform', kind: 'call' },
      { id: 'rest', from: 'platform', to: 'api', kind: 'http', label: 'REST' },
      { id: 'sse', from: 'api', to: 'platform', kind: 'sse', label: 'SSE' },
      { id: 'db', from: 'api', to: 'collections', kind: 'data' },
      { id: 'fs', from: 'api', to: 'files', kind: 'data' },
      { id: 'hook', from: 'api', to: 'hooks', kind: 'call' },
      { id: 'ai', from: 'hooks', to: 'provider', kind: 'http', label: 'proxied' },
      { id: 'sweep', from: 'hooks', to: 'collections', kind: 'data', label: 'sweep' },
    ],
    journeys: [
      { id: 'load', label: 'Load a page', hue: 205, edges: ['serve', 'boot', 'use'] },
      { id: 'save', label: 'Save a file', hue: 145, edges: ['rest', 'fs'] },
      { id: 'chat', label: 'Ask the AI', hue: 280, edges: ['rest', 'hook', 'ai'] },
      { id: 'room', label: 'Join a room', hue: 25, edges: ['rest', 'db', 'sse'] },
    ],
  })
}

// Ephemeral shared marks: hold Alt and the pointer becomes a puck, hold and
// drag and you scribble on the page. Signed-in visitors see each other's
// marks; everyone else gets a private highlighter. Nothing is persisted.
function wireDraw() {
  if (!cubby.draw) return
  cubby.draw('main', { room: '_root/draw-docs' })
}

// Copy buttons on every code block.
function wireCopyButtons() {
  for (const pre of document.querySelectorAll('pre')) {
    const button = document.createElement('button')
    button.className = 'copy'
    button.textContent = 'copy'
    button.onclick = async () => {
      try {
        await navigator.clipboard.writeText(pre.querySelector('code').textContent)
        button.textContent = 'copied'
      } catch {
        button.textContent = 'nope'
      }
      setTimeout(() => (button.textContent = 'copy'), 1200)
    }
    pre.append(button)
  }
}

// Live footer: foundation version plus a presence peek at the root lobby.
async function wireLive() {
  await cubby.ready
  document.getElementById('live-badge').textContent = `cubby v${cubby.version}`
  try {
    const lobby = cubby.rooms.room('_root/lobby')
    const pill = document.getElementById('presence-pill')
    const render = () => {
      const n = lobby.users.length
      pill.hidden = n === 0
      pill.textContent = n === 1 ? '1 person browsing' : `${n} people browsing`
    }
    lobby.on('room.sync', render)
    lobby.on('user.join', render)
    lobby.on('user.leave', render)
    await lobby.watch()
    render()
  } catch (err) {
    console.warn('presence peek unavailable:', err)
  }
}

wireNav()
wireDiagram()
wireDraw()
wireCopyButtons()
wireLive().catch((err) => console.warn(err))
