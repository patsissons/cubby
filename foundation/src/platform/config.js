import { CubbyError } from '#core'

/** Fallback used when /cubby.config.json cannot be fetched (e.g. bare local server). */
const DEFAULT_CONFIG = {
  name: 'cubby',
  title: 'Cubby',
  domain: '',
  instanceUrl: '',
  oauthProviders: [],
  ai: { defaultModel: '', models: {} },
  // Hosts whose framing headers were actually measured; see
  // foundation/src/preview/frameable.js. Same-origin never needs listing.
  preview: { frameable: [] },
  reservedNames: [],
}

/**
 * Load the deployment config served at /cubby.config.json.
 * The config is copied from the repo root into pb_public at build time,
 * so client and server hooks share one registry.
 *
 * @param {string} baseUrl origin to load the config from
 * @returns {Promise<typeof DEFAULT_CONFIG>}
 */
export async function loadConfig(baseUrl) {
  try {
    // Relative fetch works in browsers with no explicit base URL.
    const target = baseUrl ? new URL('/cubby.config.json', baseUrl) : '/cubby.config.json'
    const res = await fetch(target, { cache: 'no-cache' })
    if (!res.ok) {
      throw new CubbyError('config_unavailable', `config fetch failed with ${res.status}`, {
        status: res.status,
      })
    }
    const raw = await res.json()
    return { ...DEFAULT_CONFIG, ...raw, ai: { ...DEFAULT_CONFIG.ai, ...(raw.ai || {}) } }
  } catch (err) {
    console.warn('[cubby] could not load /cubby.config.json, using defaults:', err)
    return { ...DEFAULT_CONFIG }
  }
}
