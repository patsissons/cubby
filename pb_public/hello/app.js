// The hello app exercises every cubby module on one page: the platform
// (identity, db, fs, ai, rooms), the editor, and the core-only widgets (nav,
// preview, draw, graph). It is the integration test and the copy-from
// reference for new apps.
/* global cubby */

const $ = (id) => document.getElementById(id)


// ---- widgets --------------------------------------------------------------
//
// nav, preview, draw and graph need only core.js -- none of them touches the
// backend -- so they are wired before `await cubby.ready` rather than after.
// Each is feature-detected: an app that drops a tag keeps working.

function wireNav() {
  if (!cubby.nav) return
  // Row two is derived from the DOM: every section here carries
  // aria-labelledby pointing at its own heading id, so the bar cannot list a
  // section that no longer exists.
  cubby.nav('#sitebar', {
    label: 'Cubby',
    pages: [
      { href: '/', label: '\u{1F573}\uFE0F cubby' },
      { href: '/docs/', label: 'Docs' },
      { href: '/hello/', label: 'Hello' },
    ],
  })
}

function wirePreviews() {
  if (!cubby.preview) return
  // Delegated on the LIST, not on the heading: after the nav restructure
  // #previews is the <h2>, and the links are its siblings. The allowlist in
  // cubby.config.json decides which of these actually frame; the ones that
  // refuse still render a card naming the host, because showing nothing would
  // read as a broken feature rather than as a page that will not embed.
  cubby.preview('#preview-links', { selector: 'a[href]', delay: 600 })
}

function wireDraw() {
  if (!cubby.draw) return
  const status = $('draw-status')
  cubby.draw('main', { room: 'scribble' })
  if (status) {
    status.textContent = cubby.identity?.user
      ? 'Sharing with anyone else signed in on this page.'
      : 'Signed out: your marks stay on this screen.'
  }
}

function wireDiagram() {
  if (!cubby.graph) return
  cubby.graph('#hello-diagram', {
    label: 'What this page does',
    kinds: {
      call: { hue: 265, dash: '2 4' },
      data: { hue: 145, dash: '7 4' },
      proxy: { hue: 205, dash: '' },
    },
    lanes: [
      { id: 'page', label: 'This page' },
      { id: 'instance', label: 'Instance' },
    ],
    nodes: [
      { id: 'db', lane: 'page', column: 1, label: 'cubby.db', note: 'The guestbook above, live over SSE.' },
      { id: 'fs', lane: 'page', column: 2, label: 'cubby.fs', note: 'Notes, and images pasted into the editor.' },
      { id: 'ai', lane: 'page', column: 3, label: 'cubby.ai', note: 'Never holds a key: the instance proxies it.' },
      { id: 'guestbook', lane: 'instance', column: 1, label: 'hello_guestbook', note: 'This app owns this collection.' },
      { id: 'files', lane: 'instance', column: 2, label: 'files', note: 'Shared across apps, namespaced per app.' },
      { id: 'proxy', lane: 'instance', column: 3, label: 'pb_hooks', note: 'Applies this app\u2019s `ai` policy from cubby.json.' },
    ],
    edges: [
      { id: 'sign', from: 'db', to: 'guestbook', kind: 'data', label: 'create' },
      { id: 'watch', from: 'guestbook', to: 'db', kind: 'data', label: 'subscribe' },
      { id: 'save', from: 'fs', to: 'files', kind: 'data', label: 'write' },
      { id: 'ask', from: 'ai', to: 'proxy', kind: 'call' },
      { id: 'call', from: 'proxy', to: 'ai', kind: 'proxy', label: 'reply' },
    ],
    journeys: [
      { id: 'sign-it', label: 'Sign the guestbook', hue: 145, edges: ['sign', 'watch'] },
      { id: 'save-note', label: 'Save a note', hue: 205, edges: ['save'] },
      { id: 'ask-ai', label: 'Ask the AI', hue: 280, edges: ['ask', 'call'] },
    ],
  })
}

// ---- identity -------------------------------------------------------------
function wireIdentity() {
  const status = $('identity-status')
  const actions = $('identity-actions')

  cubby.identityChanged((user) => {
    actions.innerHTML = ''
    if (user) {
      status.textContent = `signed in as ${user.name || user.email || user.id}`
      const btn = document.createElement('button')
      btn.textContent = 'sign out'
      btn.onclick = () => cubby.identity.logout()
      actions.append(btn)
    } else {
      status.textContent = 'signed out'
      const providers = cubby.config?.oauthProviders || []
      if (!providers.length) {
        actions.textContent = 'no OAuth providers configured yet'
        return
      }
      for (const provider of providers) {
        const btn = document.createElement('button')
        btn.textContent = `sign in with ${provider}`
        btn.onclick = () =>
          cubby.identity.login(provider).catch((err) => {
            status.textContent = `login failed: ${err.message}`
          })
        actions.append(btn)
      }
    }
    document.body.classList.toggle('signed-in', !!user)
  })
}

// ---- guestbook (db + realtime) -------------------------------------------
async function wireGuestbook() {
  const list = $('guestbook-list')
  const form = $('guestbook-form')
  const input = $('guestbook-input')
  const guestbook = cubby.db.collection('guestbook')

  function render(items) {
    list.innerHTML = ''
    for (const item of items) {
      const li = document.createElement('li')
      const msg = document.createElement('span')
      msg.textContent = item.message
      const who = document.createElement('span')
      who.className = 'who'
      who.textContent = item.expand?.user?.name || 'someone'
      li.append(msg, who)
      list.append(li)
    }
  }

  async function refresh() {
    const page = await guestbook.getList(1, 20, { sort: '-created', expand: 'user' })
    render(page.items)
  }

  form.onsubmit = async (e) => {
    e.preventDefault()
    const user = cubby.identity.user
    if (!user) return alert('sign in to sign the guestbook')
    if (!input.value.trim()) return
    await guestbook.create({ message: input.value.trim(), user: user.id })
    input.value = ''
  }

  await refresh()
  // Realtime keeps every window in sync; expand is unavailable in the event
  // payload for creates from others, so just refetch (cheap at this size).
  await guestbook.subscribe('*', refresh)
  // Names only resolve for signed-in viewers, so refetch on identity change.
  cubby.identityChanged(() => {
    refresh().catch((err) => console.warn('guestbook refresh:', err))
  })
}

// ---- notes (fs) -----------------------------------------------------------
function wireNotes() {
  const text = $('note-text')
  const status = $('note-status')

  const myPath = () => {
    const user = cubby.identity.user
    if (!user) throw new cubby.CubbyError('auth_required', 'sign in to save notes')
    return `notes/${user.id}.txt`
  }

  $('note-save').onclick = async () => {
    try {
      const meta = await cubby.fs.write(myPath(), text.value)
      status.textContent = `saved ${meta.size} bytes`
    } catch (err) {
      status.textContent = err.message
    }
  }

  $('note-load').onclick = async () => {
    try {
      text.value = await cubby.fs.read(myPath())
      status.textContent = 'loaded'
    } catch (err) {
      status.textContent = err.code === 'not_found' ? 'no note saved yet' : err.message
    }
  }
}

// ---- markdown -------------------------------------------------------------
function wireMarkdown() {
  const status = $('md-status')
  // Both are opt-in: /js/markdown.js then /js/editor.js, after core.js.
  if (!cubby.editor) {
    status.textContent = 'cubby.editor missing: load /js/markdown.js then /js/editor.js'
    return
  }
  const sample = [
    '## Markdown lives here',
    '',
    'Rendering is **escaped by construction** - try `<script>` in a heading.',
    '',
    '- [x] render markdown',
    '- [ ] paste an image below (sign in first)',
    '',
    '| subsystem | global |',
    '| --- | --- |',
    '| storage | `cubby.fs` |',
    '',
    '```js',
    "const html = cubby.markdown.render('# hi')",
    '```',
    '',
    '[docs](/docs/#markdown)',
  ].join('\n')
  cubby.editor($('md-editor'), {
    value: sample,
    rows: 10,
    upload: { pathPrefix: 'uploads/' },
    onUploadStart: ({ name }) => {
      status.textContent = `uploading ${name}...`
    },
    onUpload: ({ path }) => {
      status.textContent = `uploaded to ${path}`
    },
    onError: (err) => {
      status.textContent = err.code === 'auth_required' ? 'sign in to upload images' : err.message
    },
  })
}

// ---- rooms ----------------------------------------------------------------
async function wireRooms() {
  const bar = $('presence-bar')
  const log = $('room-log')
  const lobby = cubby.rooms.room('lobby')

  function render() {
    const users = lobby.users
    bar.textContent = users.length
      ? users.map((u) => u.user.name || 'someone').join(', ')
      : 'nobody here yet'
  }

  function note(text) {
    const li = document.createElement('li')
    li.textContent = text
    log.prepend(li)
    while (log.children.length > 8) log.lastChild.remove()
  }

  lobby.on('user.join', (user) => {
    render()
    note(`${user.name || 'someone'} joined`)
  })
  lobby.on('user.leave', (user) => {
    render()
    note(`${user.name || 'someone'} left`)
  })
  lobby.on('wave', (payload, user) => {
    note(`${user.name || 'someone'} waves ${payload.emoji || '👋'}`)
  })
  lobby.on('room.sync', render)

  $('announce').onclick = () =>
    lobby.emit('wave', { emoji: '👋' }).catch((err) => note(`wave failed: ${err.message}`))

  await lobby.watch()
  render()

  // Join/leave follows sign-in state.
  let joined = false
  cubby.identityChanged(async (user) => {
    try {
      if (user && !joined) {
        joined = true
        await lobby.join()
      } else if (!user && joined) {
        joined = false
        await lobby.leave()
        await lobby.watch()
      }
      render()
    } catch (err) {
      console.warn('rooms:', err)
    }
  })
}

// ---- AI -------------------------------------------------------------------
function wireAi() {
  const output = $('ai-output')
  $('ai-greet').onclick = async () => {
    const user = cubby.identity.user
    if (!user) {
      output.textContent = 'sign in first: the AI proxy rejects anonymous calls'
      return
    }
    output.textContent = 'thinking...'
    try {
      const res = await cubby.ai.chat({
        messages: [
          { role: 'system', content: 'You greet people warmly in one short sentence.' },
          { role: 'user', content: `Say hello to ${user.name || 'a visitor'}!` },
        ],
        options: { maxTokens: 200 },
      })
      output.textContent = `${res.text}\n(${res.model} via ${res.provider}, ${res.usage.output} tokens)`
    } catch (err) {
      if (err.code === 'rate_limited') {
        output.textContent = `easy there: one prompt a minute (retry in ${err.retryAfter || 60}s)`
      } else if (err.code === 'provider_unconfigured') {
        output.textContent = `no API key configured for the default model's provider: ${err.message}`
      } else {
        output.textContent = `AI error: ${err.message}`
      }
    }
  }
}

async function main() {
  // Core-only widgets first: they need no config and no auth, so the page has
  // its chrome before the platform has finished booting.
  wireNav()
  wirePreviews()
  wireDiagram()

  await cubby.ready
  wireDraw()
  wireIdentity()
  wireNotes()
  wireMarkdown()
  wireAi()
  await wireGuestbook()
  await wireRooms()
}

main().catch((err) => {
  console.error(err)
  $('identity-status').textContent = `boot failed: ${err.message}`
})
