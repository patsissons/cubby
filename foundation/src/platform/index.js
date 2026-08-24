import PocketBase from 'pocketbase'
import { loadConfig } from './config.js'
import { CubbyError, FOUNDATION_NAMESPACE } from '#core'
import { createDb } from './db.js'
import { createIdentity } from './identity.js'
import { createFs } from './fs.js'
import { createAi } from './ai.js'
import { createRooms } from './rooms.js'

/**
 * The cubby platform: one shared PocketBase client plus small facades for
 * database, file storage, identity, AI, and rooms.
 *
 * Layered on top of core, not the other way round -- nav, graph, preview and a
 * preview-only editor need no backend, so the backend is the optional part.
 * Loaded via <script src="/js/platform.js" defer></script> AFTER core.js, or
 * as an ES module from /js/platform.esm.js.
 *
 * Every singleton in this module (state, pb, bootPromise) is module-scoped, so
 * one module instance is one "window". scripts/smoke.mjs leans on that: a
 * ?windowN query suffix gives a fresh platform instance while the un-queried
 * relative import of core.esm.js stays shared, which is exactly the browser's
 * shape -- one core.js serving every bundle on a page.
 */

/** @returns {string} first path segment, or _root on / */
function detectApp() {
  if (typeof location === 'undefined') return '_root'
  const segment = location.pathname.split('/').filter(Boolean)[0]
  return segment || '_root'
}

/** @returns {string} base URL for the PocketBase API */
function detectBaseUrl() {
  if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) {
    return location.origin
  }
  return ''
}

const state = {
  app: detectApp(),
  baseUrl: detectBaseUrl(),
  /** @type {Awaited<ReturnType<typeof loadConfig>> | null} */
  config: null,
  /** @internal cleanup hooks run by identity.logout() while the token is still valid */
  hooks: { beforeLogout: new Set() },
}

const pb = new PocketBase(state.baseUrl || undefined)

// The realtime SSE connection is bound to the auth it connected with and the
// PB SDK never rebinds it, so any subscription submitted after an identity
// change is rejected ("authorization don't match"). Cycle the connection on
// auth changes: reconnecting resubmits every live topic under the current
// identity. disconnect/connect are stable-but-undocumented SDK internals;
// the SDK version is pinned by the committed bundle.
pb.authStore.onChange(() => {
  const realtime = pb.realtime
  if (!realtime || !Object.keys(realtime.subscriptions || {}).length) return
  try {
    realtime.disconnect()
    const reconnect = realtime.connect()
    if (reconnect && typeof reconnect.catch === 'function') {
      reconnect.catch((err) => console.warn('[cubby] realtime reconnect failed:', err))
    }
  } catch (err) {
    console.warn('[cubby] realtime auth cycle failed:', err)
  }
})

/**
 * Apply overrides before ready resolves; used by local dev and tests.
 * Call synchronously after the script loads: boot defers one microtask so
 * same-tick configure() calls land before the config fetch.
 * @param {{app?: string, instanceUrl?: string}} overrides
 */
function configure(overrides = {}) {
  if (overrides.app) state.app = String(overrides.app)
  if (overrides.instanceUrl) {
    state.baseUrl = String(overrides.instanceUrl).replace(/\/+$/, '')
    pb.baseURL = state.baseUrl
  }
  if (ns) ns.app = appInfo()
  return ns
}

function appInfo() {
  return {
    name: state.app,
    base: state.app === '_root' ? '/' : `/${state.app}/`,
  }
}

async function boot() {
  const config = await loadConfig(state.baseUrl || undefined)
  state.config = config
  if (!state.baseUrl && config.instanceUrl) {
    configure({ instanceUrl: config.instanceUrl })
  }

  // Anonymous visit beacon for the discovery site's usage sorting.
  // Fire-and-forget, browser only, no user data attached. Embedded
  // contexts (dashboard hover previews, third-party iframes) do not count.
  const isTopWindow = typeof window === 'undefined' || window.self === window.top
  if (typeof document !== 'undefined' && state.app !== '_root' && isTopWindow) {
    try {
      fetch(`${state.baseUrl || ''}/_cubby/stats/visit`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app: state.app }),
      }).catch(() => {})
    } catch {
      // stats are best-effort
    }
  }

  // Validate any restored auth token; clear it when stale so identity state is trustworthy.
  if (pb.authStore.isValid) {
    try {
      await pb.collection('users').authRefresh()
    } catch {
      pb.authStore.clear()
    }
  }
  return ns
}

const { identity, identityChanged } = createIdentity(state, pb)

/** @type {object|null} the namespace this module instance was attached to */
let ns = null

/** @type {Promise<object> | null} */
let bootPromise = null

/**
 * Publish the platform onto a cubby namespace (one already carrying core).
 *
 * Idempotent by the _pb marker: loading platform.js twice, or alongside the
 * deprecated foundation.js, must never create a second PocketBase client, a
 * second realtime connection, or a second visit beacon.
 *
 * `config` and `ready` go on via defineProperties, not Object.assign --
 * assigning would evaluate the getters once, freezing config at null and, far
 * worse, booting immediately. Boot has to stay lazy so a configure() call made
 * before the first `await cubby.ready` still lands first.
 *
 * @param {object} target
 * @returns {object} the same namespace, populated
 */
export function attachPlatform(target) {
  if (target._pb) return target
  ns = target

  Object.assign(target, {
    app: appInfo(),
    configure,
    db: createDb(state, pb),
    fs: createFs(state, pb),
    ai: createAi(state, pb),
    rooms: createRooms(state, pb),
    identity,
    identityChanged,
    /** @internal shared state for platform modules */
    _state: state,
    /** @internal shared PocketBase client */
    _pb: pb,
  })

  Object.defineProperties(target, {
    config: {
      enumerable: true,
      /** The deployment config (cubby.config.json); null until ready resolves. */
      get() {
        return state.config
      },
    },
    ready: {
      enumerable: true,
      /**
       * Resolves after config fetch and auth restore. Boot starts on first
       * access, so configure() calls made before the first await apply first.
       */
      get() {
        if (!bootPromise) bootPromise = boot()
        return bootPromise
      },
    },
  })

  return target
}

export { CubbyError, FOUNDATION_NAMESPACE }
