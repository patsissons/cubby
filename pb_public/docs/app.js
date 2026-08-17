// Docs app: scrollspy for the section nav, copy buttons on code blocks, and
// a live footer that proves the page is itself a cubby app.
/* global cubby */

// Scrollspy: highlight the nav link for the section in view.
function wireScrollspy() {
  const links = [...document.querySelectorAll('#toc a[href^="#"]')]
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]))
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        links.forEach((a) => a.classList.remove('active'))
        byId.get(entry.target.id)?.classList.add('active')
      }
    },
    { rootMargin: '-15% 0px -75% 0px' }
  )
  for (const id of byId.keys()) {
    const section = document.getElementById(id)
    if (section) observer.observe(section)
  }
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

wireScrollspy()
wireCopyButtons()
wireLive().catch((err) => console.warn(err))
