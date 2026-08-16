// Foundation smoke test. Runs the built ESM bundle in Node against a live
// instance (local dev server by default), using superuser impersonation to
// obtain an authenticated test user without OAuth.
//
//   npm run dev            # in another terminal
//   node scripts/smoke.mjs
//
// Env: SMOKE_URL (default http://127.0.0.1:8091), SMOKE_SUPERUSER_EMAIL,
// SMOKE_SUPERUSER_PASSWORD (default local dev superuser).
import assert from 'node:assert/strict'
import { EventSource } from 'eventsource'

// PB SDK realtime needs a browser EventSource; polyfill it for Node.
if (typeof globalThis.EventSource === 'undefined') globalThis.EventSource = EventSource

const BASE = (process.env.SMOKE_URL || 'http://127.0.0.1:8091').replace(/\/+$/, '')
const EMAIL = process.env.SMOKE_SUPERUSER_EMAIL || 'local@cubby.test'
const PASSWORD = process.env.SMOKE_SUPERUSER_PASSWORD || 'cubby-local-dev'

const { default: cubby, CubbyError } = await import('../pb_public/js/foundation.esm.js')
cubby.configure({ app: 'hello', instanceUrl: BASE })
await cubby.ready

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

// Superuser session (raw fetch, separate from the foundation client).
async function api(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
    },
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

// Find or create the smoke test user, then impersonate it.
const search = await fetch(
  `${BASE}/api/collections/users/records?filter=${encodeURIComponent("email='smoke@cubby.test'")}`,
  { headers: { Authorization: su.token } }
).then((r) => r.json())

let testUser = search.items?.[0]
if (!testUser) {
  testUser = await api(
    '/api/collections/users/records',
    {
      email: 'smoke@cubby.test',
      name: 'Smoke Tester',
      password: crypto.randomUUID(),
      passwordConfirm: undefined,
    },
    su.token
  ).catch(async () => {
    const pw = crypto.randomUUID()
    return api(
      '/api/collections/users/records',
      { email: 'smoke@cubby.test', name: 'Smoke Tester', password: pw, passwordConfirm: pw },
      su.token
    )
  })
}

const impersonated = await api(`/api/collections/users/impersonate/${testUser.id}`, { duration: 3600 }, su.token)
cubby._pb.authStore.save(impersonated.token, impersonated.record)

console.log(`smoke: ${BASE} as ${impersonated.record.email} (cubby v${cubby.version})`)

await test('identity.user reflects the impersonated session', () => {
  assert.equal(cubby.identity.user?.id, testUser.id)
})

await test('identityChanged fires immediately and unsubscribes', () => {
  let calls = 0
  const off = cubby.identityChanged(() => calls++)
  assert.equal(calls, 1)
  off()
})

await test('db.collection resolves app prefixes', () => {
  assert.equal(cubby.db.collection('guestbook').collectionIdOrName, 'hello_guestbook')
  assert.equal(cubby.db.collection('otherapp/items').collectionIdOrName, 'otherapp_items')
  assert.equal(cubby.db.collection('my-app/items').collectionIdOrName, 'my_app_items')
  assert.throws(() => cubby.db.collection('Bad Name'), CubbyError)
  assert.throws(() => cubby.db.collection('a/b/c'), CubbyError)
})

let created
await test('db: guestbook create and list', async () => {
  created = await cubby.db.collection('guestbook').create({
    message: `smoke test at ${new Date().toISOString()}`,
    user: testUser.id,
  })
  const list = await cubby.db.collection('guestbook').getList(1, 5, { sort: '-created', expand: 'user' })
  const mine = list.items.find((r) => r.id === created.id)
  assert.ok(mine)
  assert.equal(mine.expand?.user?.name, 'Smoke Tester', 'signed-in viewers resolve author names')
})

await test('db: realtime subscribe receives create events', async () => {
  if (typeof EventSource === 'undefined') {
    console.log('     (EventSource unavailable in this Node; verify in browser)')
    return
  }
  let onEvent
  const got = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no realtime event within 5s')), 5000)
    onEvent = (e) => {
      if (e.action === 'create') {
        clearTimeout(timer)
        resolve(e.record)
      }
    }
  })
  await cubby.db.collection('guestbook').subscribe('*', onEvent)
  const record = await cubby.db.collection('guestbook').create({
    message: 'realtime smoke',
    user: testUser.id,
  })
  const received = await got
  assert.equal(received.id, record.id)
  await cubby.db.collection('guestbook').unsubscribe('*')
  await cubby.db.collection('guestbook').delete(record.id)
})

await test('fs: write, read, list, url, remove round trip', async () => {
  const path = 'smoke/note.txt'
  const body = `hello from smoke ${Date.now()}`
  const meta = await cubby.fs.write(path, body)
  assert.equal(meta.path, path)
  assert.ok(meta.size > 0)

  assert.equal(await cubby.fs.read(path), body)

  const listing = await cubby.fs.list('smoke/')
  assert.ok(listing.some((f) => f.path === path && f.size === meta.size))

  const url = await cubby.fs.url(path)
  const viaUrl = await fetch(url).then((r) => r.text())
  assert.equal(viaUrl, body)

  const blob = await cubby.fs.readBlob(path)
  assert.equal(await blob.text(), body)

  await cubby.fs.remove(path)
  await assert.rejects(() => cubby.fs.read(path), (err) => err.code === 'not_found')
})

await test('fs: write upserts on same path', async () => {
  await cubby.fs.write('smoke/upsert.txt', 'one')
  await cubby.fs.write('smoke/upsert.txt', 'two')
  assert.equal(await cubby.fs.read('smoke/upsert.txt'), 'two')
  const listing = await cubby.fs.list('smoke/upsert.txt')
  assert.equal(listing.length, 1)
  await cubby.fs.remove('smoke/upsert.txt')
})

await test('fs: rejects traversal and absolute-ish paths', async () => {
  await assert.rejects(() => cubby.fs.write('../escape.txt', 'x'), (e) => e.code === 'bad_path')
  await assert.rejects(() => cubby.fs.write('a/../b.txt', 'x'), (e) => e.code === 'bad_path')
})

await test('fs: cross-app read via { app } option', async () => {
  await cubby.fs.write('smoke/shared.txt', 'cross-app hello')
  const other = cubby.configure({ app: '_root' })
  const content = await other.fs.read('smoke/shared.txt', { app: 'hello' })
  assert.equal(content, 'cross-app hello')
  cubby.configure({ app: 'hello' })
  await cubby.fs.remove('smoke/shared.txt')
})

// Rooms: a second foundation instance (fresh module via query suffix) plays
// the "other browser window" with its own impersonated user.
const { default: cubby2 } = await import('../pb_public/js/foundation.esm.js?window2')
cubby2.configure({ app: 'hello', instanceUrl: BASE })
await cubby2.ready

const search2 = await fetch(
  `${BASE}/api/collections/users/records?filter=${encodeURIComponent("email='smoke2@cubby.test'")}`,
  { headers: { Authorization: su.token } }
).then((r) => r.json())
let testUser2 = search2.items?.[0]
if (!testUser2) {
  const pw = crypto.randomUUID()
  testUser2 = await api(
    '/api/collections/users/records',
    { email: 'smoke2@cubby.test', name: 'Smoke Buddy', password: pw, passwordConfirm: pw },
    su.token
  )
}
const impersonated2 = await api(`/api/collections/users/impersonate/${testUser2.id}`, { duration: 3600 }, su.token)
cubby2._pb.authStore.save(impersonated2.token, impersonated2.record)

function within(ms, label) {
  let resolve
  let timer
  const promise = new Promise((res, rej) => {
    timer = setTimeout(() => rej(new Error(`${label}: timed out after ${ms}ms`)), ms)
    resolve = (value) => {
      clearTimeout(timer)
      res(value)
    }
  })
  return { promise, resolve }
}

const roomA = cubby.rooms.room('smoke-lobby')
const roomB = cubby2.rooms.room('smoke-lobby')

await test('rooms: join, presence visibility across clients', async () => {
  const joinSeen = within(5000, 'user.join')
  await roomB.watch()
  roomB.on('user.join', (user) => {
    if (user.id === testUser.id) joinSeen.resolve(user)
  })
  await roomA.join()
  const joinedUser = await joinSeen.promise
  assert.equal(joinedUser.id, testUser.id)
  assert.equal(joinedUser.name, 'Smoke Tester', 'signed-in watchers resolve names via expand')
  assert.ok(roomA.id === 'hello/smoke-lobby')
  const selfEntry = roomA.users.find((u) => u.user.id === testUser.id)
  assert.ok(selfEntry)
  assert.equal(selfEntry.user.name, 'Smoke Tester', 'own roster entry resolves the name')
})

await test('rooms: updateUserState propagates', async () => {
  const stateSeen = within(5000, 'user.state')
  roomB.on('user.state', (prev, next, user) => {
    if (user.id === testUser.id && next.msg === 'hello') stateSeen.resolve({ prev, next })
  })
  await roomA.updateUserState({ msg: 'hello' })
  const { next } = await stateSeen.promise
  assert.equal(next.msg, 'hello')
})

await test('rooms: custom emit reaches other client', async () => {
  const eventSeen = within(5000, 'announce')
  roomB.on('announce', (payload, user) => {
    if (user.id === testUser.id) eventSeen.resolve(payload)
  })
  await roomA.emit('announce', { msg: 'here!' })
  const payload = await eventSeen.promise
  assert.equal(payload.msg, 'here!')
})

await test('rooms: leave emits user.leave', async () => {
  const leaveSeen = within(5000, 'user.leave')
  roomB.on('user.leave', (user) => {
    if (user.id === testUser.id) leaveSeen.resolve(user)
  })
  await roomA.leave()
  await leaveSeen.promise
  await roomB.leave()
})

await test('rooms: emit rejects reserved and unauthenticated use', async () => {
  await assert.rejects(() => roomA.emit('user.fake', {}), (e) => e.code === 'bad_request')
  await assert.rejects(() => roomA.emit('room.fake', {}), (e) => e.code === 'bad_request')
})

await test('rooms: names resolve after signing in mid-watch', async () => {
  const { default: cubby3 } = await import('../pb_public/js/foundation.esm.js?window3')
  cubby3.configure({ app: 'hello', instanceUrl: BASE })
  await cubby3.ready

  const occupied = cubby.rooms.room('smoke-lobby2')
  await occupied.join()

  const watcher = cubby3.rooms.room('smoke-lobby2')
  await watcher.watch()
  const anonEntry = watcher.users.find((u) => u.user.id === testUser.id)
  assert.ok(anonEntry, 'anonymous watcher sees presence')
  assert.ok(!anonEntry.user.name, 'anonymous watcher cannot resolve names (auth-gated)')

  // Signing in must rebuild the subscription and roster with the new auth.
  cubby3._pb.authStore.save(impersonated2.token, impersonated2.record)
  const deadline = Date.now() + 5000
  let named
  while (Date.now() < deadline) {
    named = watcher.users.find((u) => u.user.id === testUser.id)
    if (named?.user?.name) break
    await new Promise((r) => setTimeout(r, 200))
  }
  assert.equal(named?.user?.name, 'Smoke Tester', 'names resolve after mid-watch sign-in')

  await watcher.leave()
  await occupied.leave()
  cubby3._pb.authStore.clear()
})

await test('hooks: sweep endpoint responds', async () => {
  const res = await fetch(`${BASE}/_cubby/cron/sweep`)
  const json = await res.json()
  assert.equal(res.status, 200)
  assert.equal(json.ok, true)
})

await test('ai: anonymous requests rejected', async () => {
  const res = await fetch(`${BASE}/_cubby/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  })
  assert.equal(res.status, 401)
})

await test('ai: unknown model alias throws client-side', async () => {
  await assert.rejects(
    () => cubby.ai.chat({ messages: [{ role: 'user', content: 'hi' }], model: 'nope' }),
    (e) => e.code === 'model_unknown'
  )
})

await test('ai: chat proxies or reports provider_unconfigured cleanly', async () => {
  try {
    const res = await cubby.ai.chat({
      messages: [
        { role: 'system', content: 'answer with just the number' },
        { role: 'user', content: 'what is 2 + 2?' },
      ],
      options: { maxTokens: 200 },
    })
    assert.ok(res.text.includes('4'), `expected "4" in: ${res.text}`)
    assert.equal(res.provider, 'gemini')
    assert.ok(res.usage.output > 0)
    console.log(`     (live ${res.provider} reply: ${JSON.stringify(res.text.slice(0, 60))})`)
  } catch (err) {
    if (err.code === 'provider_unconfigured') {
      console.log('     (no GEMINI_API_KEY in server env; clean 503 verified)')
      assert.equal(err.status, 503)
    } else {
      throw err
    }
  }
})

if (created) await cubby.db.collection('guestbook').delete(created.id).catch(() => {})
cubby._pb.authStore.clear()
cubby2._pb.authStore.clear()

console.log(process.exitCode ? 'SMOKE FAILED' : `smoke passed (${passed} tests)`)
process.exit(process.exitCode || 0)
