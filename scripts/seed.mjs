// Seeds local demo data for the hello app: a demo user and a few guestbook
// entries. Local dev only; never run against production.
//
//   npm run dev     # in another terminal
//   npm run seed
const BASE = (process.env.SMOKE_URL || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EMAIL = process.env.SMOKE_SUPERUSER_EMAIL || 'local@cubby.test'
const PASSWORD = process.env.SMOKE_SUPERUSER_PASSWORD || 'cubby-local-dev'

async function api(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${JSON.stringify(json)}`)
  return json
}

const su = await api('/api/collections/_superusers/auth-with-password', {
  identity: EMAIL,
  password: PASSWORD,
})

const found = await fetch(
  `${BASE}/api/collections/users/records?filter=${encodeURIComponent("email='demo@cubby.test'")}`,
  { headers: { Authorization: su.token } }
).then((r) => r.json())

let demo = found.items?.[0]
if (!demo) {
  const pw = crypto.randomUUID()
  demo = await api(
    '/api/collections/users/records',
    { email: 'demo@cubby.test', name: 'Demo Cub', password: pw, passwordConfirm: pw },
    su.token
  )
  console.log('created demo user demo@cubby.test')
}

const messages = [
  'first! this guestbook updates live in every window',
  'tiny apps, one shelf',
  'signed from the seed script',
]
for (const message of messages) {
  await api('/api/collections/hello_guestbook/records', { message, user: demo.id }, su.token)
}
console.log(`seeded ${messages.length} guestbook entries as ${demo.name}`)
