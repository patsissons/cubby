// Docs app: the sticky site bar, copy buttons on code blocks, and a live
// footer that proves the page is itself a cubby app.
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
wireCopyButtons()
wireLive().catch((err) => console.warn(err))
