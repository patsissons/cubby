// The hello app exercises every cubby subsystem on one page. It is the
// integration test and the copy-from reference for new apps.
/* global cubby */

const $ = (id) => document.getElementById(id)

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
      output.textContent =
        err.code === 'provider_unconfigured'
          ? `no API key configured for the default model's provider: ${err.message}`
          : `AI error: ${err.message}`
    }
  }
}

async function main() {
  await cubby.ready
  wireIdentity()
  wireNotes()
  wireAi()
  await wireGuestbook()
  await wireRooms()
}

main().catch((err) => {
  console.error(err)
  $('identity-status').textContent = `boot failed: ${err.message}`
})
