// Shared hook utilities: config loading and auth checks.
// Runs in the PocketBase JSVM (goja): synchronous, CommonJS, no Node APIs.

/** Read the deployment config from the pb_public copy (single shared registry). */
function loadCubbyConfig() {
  const path = `${__hooks}/../pb_public/cubby.config.json`
  const raw = toString($os.readFile(path))
  return JSON.parse(raw)
}

/**
 * Resolve a model alias against the config registry.
 * @param {string} alias
 * @returns {{alias: string, provider: string, id: string}}
 */
function resolveModel(alias) {
  const config = loadCubbyConfig()
  const ai = config.ai || {}
  const registry = ai.models || {}
  const key = alias || ai.defaultModel
  const entry = registry[key]
  if (!entry) {
    throw { code: 'model_unknown', status: 400, message: `unknown model alias "${key}"` }
  }
  return { alias: key, provider: entry.provider, id: entry.id }
}

/**
 * Load an app's AI policy from its committed manifest. Deny-by-default:
 * apps without an ai block (or without a manifest at all) get no models.
 * @param {string} app
 * @returns {{models: string[], allowAnonymous: boolean, rateLimitSeconds: number}}
 */
function loadAppAiPolicy(app) {
  const defaults = { models: [], allowAnonymous: false, rateLimitSeconds: 60 }
  let manifest = {}
  try {
    manifest = JSON.parse(toString($os.readFile(`${__hooks}/../pb_public/${app}/cubby.json`)))
  } catch (err) {
    return defaults
  }
  const ai = manifest.ai || {}
  return {
    models: Array.isArray(ai.models) ? ai.models.map(String) : defaults.models,
    allowAnonymous: ai.allowAnonymous === true,
    rateLimitSeconds:
      typeof ai.rateLimitSeconds === 'number' && ai.rateLimitSeconds >= 0
        ? ai.rateLimitSeconds
        : defaults.rateLimitSeconds,
  }
}

module.exports = { loadCubbyConfig, resolveModel, loadAppAiPolicy }
