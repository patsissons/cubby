// Template app. The cubby foundation is loaded by index.html; wait for
// cubby.ready before touching cubby.* APIs.
/* global cubby */

const view = document.getElementById('view')
const whoami = document.getElementById('whoami')

// Minimal hash router: render based on location.hash (#/page).
function route() {
  const page = (location.hash.replace(/^#\/?/, '') || 'home').split('/')[0]
  if (page === 'about') {
    view.innerHTML = `<p>This is <strong>${cubby.app.name}</strong>, served from ${cubby.app.base}.</p>`
  } else {
    view.innerHTML = '<p>Hello from the template. Start building.</p>'
  }
}

async function main() {
  await cubby.ready

  cubby.identityChanged((user) => {
    whoami.textContent = user ? `signed in as ${user.name || user.id}` : 'not signed in'
  })

  window.addEventListener('hashchange', route)
  route()
}

main().catch((err) => {
  console.error(err)
  view.textContent = `something broke: ${err.message}`
})
