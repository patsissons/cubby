import { CubbyError, toCubbyError } from './errors.js'

const HEARTBEAT_MS = 20000

/**
 * Multi-user rooms over PocketBase realtime (SSE). Presence lives in
 * rooms_presence (one record per room+user, heartbeated), custom events in
 * rooms_events (fire-and-forget). Expect 100-500ms latency: fine for chat,
 * presence, and casual multiplayer; not for twitch gameplay.
 *
 * @param {{app: string}} state
 * @param {import('pocketbase').default} pb
 */
export function createRooms(state, pb) {
  const presence = () => pb.collection('rooms_presence')
  const events = () => pb.collection('rooms_events')

  /**
   * @param {string} name 'lobby' or cross-app 'otherapp/lobby'
   * @returns {string} namespaced room id '<app>/<name>'
   */
  function resolveRoom(name) {
    if (typeof name !== 'string' || !name) {
      throw new CubbyError('bad_request', 'room name required')
    }
    if (name.includes('/')) {
      const parts = name.split('/')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new CubbyError('bad_request', `invalid room reference "${name}"`)
      }
      return name
    }
    return `${state.app}/${name}`
  }

  function room(name) {
    const id = resolveRoom(name)

    /** @type {Map<string, Set<Function>>} event name -> handlers */
    const handlers = new Map()
    /** @type {Map<string, {user: object, state: object, recordId: string}>} userId -> entry */
    const present = new Map()

    let joined = false
    let watching = false
    let heartbeatTimer = null
    let myRecordId = null
    let unsubPresence = null
    let unsubEvents = null

    function fire(event, ...args) {
      const set = handlers.get(event)
      if (!set) return
      for (const fn of set) {
        try {
          fn(...args)
        } catch (err) {
          console.error(`[cubby.rooms] handler for "${event}" threw:`, err)
        }
      }
    }

    function userOf(record) {
      return record.expand?.user || { id: record.user }
    }

    function onPresenceEvent(e) {
      const user = userOf(e.record)
      if (e.action === 'create') {
        present.set(user.id, { user, state: e.record.state || {}, recordId: e.record.id })
        fire('user.join', user)
      } else if (e.action === 'update') {
        const prev = present.get(user.id)?.state || {}
        const next = e.record.state || {}
        present.set(user.id, { user, state: next, recordId: e.record.id })
        fire('user.state', prev, next, user)
      } else if (e.action === 'delete') {
        present.delete(user.id)
        fire('user.leave', user)
      }
    }

    async function subscribe() {
      if (watching) return
      watching = true
      try {
        unsubPresence = await presence().subscribe('*', onPresenceEvent, {
          filter: pb.filter('room = {:room}', { room: id }),
          expand: 'user',
        })
        unsubEvents = await events().subscribe(
          '*',
          (e) => {
            if (e.action !== 'create') return
            fire(e.record.event, e.record.payload, userOf(e.record))
          },
          { filter: pb.filter('room = {:room}', { room: id }), expand: 'user' }
        )
        await refresh()
      } catch (err) {
        watching = false
        throw toCubbyError(err)
      }
    }

    async function refresh() {
      const records = await presence().getFullList({
        filter: pb.filter('room = {:room}', { room: id }),
        expand: 'user',
      })
      present.clear()
      for (const record of records) {
        const user = userOf(record)
        present.set(user.id, { user, state: record.state || {}, recordId: record.id })
      }
    }

    async function upsertPresence(patch) {
      const me = pb.authStore.record
      const seen = new Date().toISOString()
      try {
        const existing = await presence()
          .getFirstListItem(pb.filter('room = {:room} && user = {:user}', { room: id, user: me.id }))
          .catch((err) => {
            if (err?.status === 404) return null
            throw err
          })
        const record = existing
          ? await presence().update(existing.id, { seen, ...patch })
          : await presence().create({ room: id, user: me.id, state: {}, seen, ...patch })
        myRecordId = record.id
        return record
      } catch (err) {
        throw toCubbyError(err)
      }
    }

    function stopHeartbeat() {
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }

    function beaconLeave() {
      // Best-effort presence cleanup on tab close; the sweeper covers the rest.
      if (!myRecordId || !pb.authStore.token) return
      try {
        fetch(`${pb.baseURL}/api/collections/rooms_presence/records/${myRecordId}`, {
          method: 'DELETE',
          keepalive: true,
          headers: { Authorization: pb.authStore.token },
        }).catch(() => {})
      } catch {
        // ignore
      }
    }

    const api = {
      /** The namespaced room id, '<app>/<name>'. */
      id,

      /**
       * Register a handler. Built-in events: 'user.join' (user),
       * 'user.leave' (user), 'user.state' (prev, next, user). Anything else
       * is a custom event fired by emit: handler(payload, user).
       * @param {string} event
       * @param {Function} fn
       * @returns {() => void} unsubscribe
       */
      on(event, fn) {
        if (!handlers.has(event)) handlers.set(event, new Set())
        handlers.get(event).add(fn)
        return () => handlers.get(event)?.delete(fn)
      },

      /**
       * Observe the room without joining (no presence record). Works
       * logged-out: used by the discovery site presence count.
       */
      async watch() {
        await subscribe()
        return api
      },

      /** Join the room: requires auth, creates presence, starts heartbeat. */
      async join() {
        if (!pb.authStore.isValid) {
          throw new CubbyError('auth_required', 'sign in before joining a room')
        }
        await subscribe()
        await upsertPresence({})
        joined = true
        stopHeartbeat()
        heartbeatTimer = setInterval(() => {
          upsertPresence({}).catch((err) => console.warn('[cubby.rooms] heartbeat failed:', err))
        }, HEARTBEAT_MS)
        if (typeof window !== 'undefined') {
          window.addEventListener('pagehide', beaconLeave)
        }
        return api
      },

      /**
       * Merge a patch into this user's shared room state.
       * @param {object} patch
       */
      async updateUserState(patch) {
        if (!joined) throw new CubbyError('bad_request', 'join the room before updating state')
        const mine = present.get(pb.authStore.record.id)?.state || {}
        await upsertPresence({ state: { ...mine, ...patch } })
      },

      /**
       * Broadcast a custom event to the room. Fire-and-forget.
       * @param {string} event
       * @param {object} [payload]
       */
      async emit(event, payload = {}) {
        if (!pb.authStore.isValid) {
          throw new CubbyError('auth_required', 'sign in before emitting room events')
        }
        if (typeof event !== 'string' || !event || event.startsWith('user.')) {
          throw new CubbyError('bad_request', 'custom event names must not start with "user."')
        }
        try {
          await events().create({ room: id, event, payload, user: pb.authStore.record.id })
        } catch (err) {
          throw toCubbyError(err)
        }
      },

      /** Current presence: [{ user, state }]. */
      get users() {
        return [...present.values()].map(({ user, state: s }) => ({ user, state: s }))
      },

      /** Leave: delete presence, stop heartbeat, unsubscribe. */
      async leave() {
        stopHeartbeat()
        if (typeof window !== 'undefined') {
          window.removeEventListener('pagehide', beaconLeave)
        }
        if (myRecordId) {
          await presence()
            .delete(myRecordId)
            .catch(() => {})
          myRecordId = null
        }
        joined = false
        watching = false
        if (unsubPresence) unsubPresence()
        if (unsubEvents) unsubEvents()
        unsubPresence = unsubEvents = null
        present.clear()
      },
    }

    return api
  }

  return { room }
}
