import PocketBase from 'pocketbase'
import { FOUNDATION_NAMESPACE, loadConfig } from './config.js'
import { CubbyError } from './errors.js'
import { createDb } from './db.js'
import { createIdentity } from './identity.js'
import { createFs } from './fs.js'
import { createAi } from './ai.js'
import { createRooms } from './rooms.js'

/**
 * The cubby foundation: one shared PocketBase client plus small facades for
 * database, file storage, identity, AI, and rooms. Loaded by every app via
 * <script src="/js/foundation.js"></script> or as an ES module.
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
}

const pb = new PocketBase(state.baseUrl || undefined)

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
  cubby.app = appInfo()
  return cubby
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

  // Validate any restored auth token; clear it when stale so identity state is trustworthy.
  if (pb.authStore.isValid) {
    try {
      await pb.collection('users').authRefresh()
    } catch {
      pb.authStore.clear()
    }
  }
  return cubby
}

const { identity, identityChanged } = createIdentity(state, pb)

// __CUBBY_VERSION__ is replaced by esbuild's define with the package.json version.
const cubby = {
  version: typeof __CUBBY_VERSION__ === 'undefined' ? 'dev' : __CUBBY_VERSION__,
  app: appInfo(),
  configure,
  CubbyError,
  db: createDb(state, pb),
  fs: createFs(state, pb),
  ai: createAi(state, pb),
  rooms: createRooms(state, pb),
  identity,
  identityChanged,
  /** The deployment config (cubby.config.json); null until ready resolves. */
  get config() {
    return state.config
  },
  /**
   * Resolves after config fetch and auth restore. Boot starts on first
   * access, so configure() calls made before the first await apply first.
   */
  get ready() {
    if (!bootPromise) bootPromise = boot()
    return bootPromise
  },
  /** @internal shared state for foundation modules */
  _state: state,
  /** @internal shared PocketBase client */
  _pb: pb,
}

/** @type {Promise<typeof cubby> | null} */
let bootPromise = null

export default cubby
export { CubbyError, FOUNDATION_NAMESPACE }
