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
 *
 * @param {string} app
 */
function loadAppAiPolicy(app) {
  let manifest = {}
  try {
    manifest = JSON.parse(toString($os.readFile(`${__hooks}/../pb_public/${app}/cubby.json`)))
  } catch (err) {
    return parseAiPolicy(null)
  }
  return parseAiPolicy(manifest.ai)
}

/**
 * Normalize a cubby.json "ai" block into a policy with every default filled
 * in. Pure, so Node tests can call it.
 *
 * Fields (all optional in the manifest):
 *   models           allowlist of registry aliases (default [])
 *   allowAnonymous   default false
 *   rateLimitSeconds min seconds between prompts per caller (default 60; 0 disables)
 *   allowedUsers     email globs, e.g. ["me@x.com", "*@corp.com"] (default []: any signed-in user)
 *   maxChars         total text length cap across messages (default 4000; 0
 *                    disables); image parts do not count toward it
 *   maxMessages      message count cap (default 16)
 *   maxTokens        cap on options.maxTokens (default 1000)
 *   messagePatterns  role -> regex or list of regexes (message must match
 *                    at least one); when present, EVERY message's role must
 *                    have an entry (closes the unlisted-role injection hole)
 *   maxImages        image parts allowed per request (default 0: none)
 *   maxImageBytes    decoded size cap per image (default 8 MB)
 *   reasoning        reasoning effort levels callers may request, e.g.
 *                    ["high"] (default []: none)
 *   webSearch        false (default), true, or { maxResults: N } (1..25;
 *                    true means 5): the per-call cap on web search results
 *   timeoutSeconds   provider request timeout (default 60, clamped 10..300)
 *
 * @param {object|null|undefined} ai the manifest's "ai" block
 */
function parseAiPolicy(ai) {
  const defaults = {
    models: [],
    allowAnonymous: false,
    rateLimitSeconds: 60,
    allowedUsers: [],
    maxChars: 4000,
    maxMessages: 16,
    maxTokens: 1000,
    messagePatterns: null,
    maxImages: 0,
    maxImageBytes: 8 * 1024 * 1024,
    reasoning: [],
    webSearch: null,
    timeoutSeconds: 60,
  }
  if (!ai || typeof ai !== 'object') return defaults
  const num = (value, fallback) => (typeof value === 'number' && value >= 0 ? value : fallback)
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.floor(value)))
  let webSearch = null
  if (ai.webSearch === true) webSearch = { maxResults: 5 }
  else if (ai.webSearch && typeof ai.webSearch === 'object' && typeof ai.webSearch.maxResults === 'number') {
    webSearch = { maxResults: clamp(ai.webSearch.maxResults, 1, 25) }
  }
  return {
    models: Array.isArray(ai.models) ? ai.models.map(String) : defaults.models,
    allowAnonymous: ai.allowAnonymous === true,
    rateLimitSeconds: num(ai.rateLimitSeconds, defaults.rateLimitSeconds),
    allowedUsers: Array.isArray(ai.allowedUsers) ? ai.allowedUsers.map(String) : defaults.allowedUsers,
    maxChars: num(ai.maxChars, defaults.maxChars),
    maxMessages: num(ai.maxMessages, defaults.maxMessages) || defaults.maxMessages,
    maxTokens: num(ai.maxTokens, defaults.maxTokens) || defaults.maxTokens,
    messagePatterns:
      ai.messagePatterns && typeof ai.messagePatterns === 'object' && Object.keys(ai.messagePatterns).length
        ? ai.messagePatterns
        : null,
    maxImages: Math.floor(num(ai.maxImages, defaults.maxImages)),
    maxImageBytes: num(ai.maxImageBytes, defaults.maxImageBytes) || defaults.maxImageBytes,
    reasoning: Array.isArray(ai.reasoning) ? ai.reasoning.map(String) : defaults.reasoning,
    webSearch,
    timeoutSeconds: clamp(num(ai.timeoutSeconds, defaults.timeoutSeconds), 10, 300),
  }
}

/**
 * Match a value against a glob: "*" matches any run of characters (dots
 * included), everything else is literal, case-insensitive, anchored.
 * @param {string} value
 * @param {string} glob
 */
function globMatches(value, glob) {
  const pattern = String(glob)
    .toLowerCase()
    .replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '*' ? '\0' : `\\${c}`))
    .replace(/\0/g, '.*')
  return new RegExp(`^${pattern}$`).test(String(value).toLowerCase())
}

/**
 * Match an email against a policy glob ("*" wildcards, case-insensitive).
 * @param {string} email
 * @param {string} glob
 */
function emailMatches(email, glob) {
  return globMatches(email, glob)
}

/**
 * The hostnames a deployment answers on, from cubby.config.json domain and
 * instanceUrl: lowercased, without scheme, port or path, deduplicated.
 * Regex rather than URL, which goja lacks. Pure.
 * @param {object|null} config parsed cubby.config.json
 * @returns {string[]}
 */
function deploymentHosts(config) {
  const hosts = []
  for (const value of [config && config.domain, config && config.instanceUrl]) {
    if (typeof value !== 'string') continue
    const host = value
      .trim()
      .toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
      .replace(/[/?#].*$/, '')
      .replace(/:\d*$/, '')
    if (host && !hosts.includes(host)) hosts.push(host)
  }
  return hosts
}

/**
 * Problems with a domain-scoped "hidden" object ({ on?, except? }); []
 * means well formed. parseVisibility fails closed on any of them and the
 * build names them.
 * @param {object} hidden
 * @returns {string[]}
 */
function domainRuleProblems(hidden) {
  const problems = []
  for (const key of Object.keys(hidden)) {
    if (key !== 'on' && key !== 'except') problems.push(`unknown key "${key}" (expected "on" or "except")`)
  }
  let domains = 0
  let malformed = false
  for (const key of ['on', 'except']) {
    const list = hidden[key]
    if (list === undefined) continue
    if (!Array.isArray(list) || !list.every((d) => typeof d === 'string' && d)) {
      problems.push(`"${key}" must be an array of domain globs`)
      malformed = true
      continue
    }
    domains += list.length
  }
  if (!domains && !malformed) problems.push('needs at least one domain in "on" or "except"')
  return problems
}

/**
 * An app's access declaration: whether the app sits behind identity.
 *
 *   "access": { "allowedUsers": ["me@x.com", "*@corp.com"] }
 *
 * allowedUsers takes email globs (matched with emailMatches); [] or missing
 * means any signed-in user, the same as ai.allowedUsers. Any access block
 * makes the agent-readable surfaces withhold the app's content entirely:
 * GET /_cubby/content/<app> and the MCP read_app tool. Fails closed: a
 * malformed block still counts as gated (the build rejects malformed
 * blocks anyway). Pure, so Node tests can call it.
 *
 * @param {object|null} manifest parsed cubby.json
 * @returns {{ allowedUsers: string[] } | null} null when the app is open
 */
function parseAccess(manifest) {
  if (!manifest || typeof manifest !== 'object') return null
  const access = manifest.access
  if (access === undefined || access === null) return null
  const users = access && typeof access === 'object' && Array.isArray(access.allowedUsers) ? access.allowedUsers : []
  return { allowedUsers: users.map(String) }
}

/**
 * Who sees an app's card on the discovery site, from cubby.json "hidden":
 *
 *   absent / false   'public'  everyone (sites.json)
 *   true             'hidden'  nobody
 *   "access"         'access'  signed-in users matching access.allowedUsers,
 *                              served per user by GET /_cubby/sites/scoped
 *   { on, except }   'hidden' when the deployment's hosts match a glob in
 *                    "on" (or "on" is absent) and none matches "except";
 *                    'public' otherwise
 *
 * "access" reuses the app's access block rather than a second list, so it
 * needs one. Domain rules match the deployment's configured hosts
 * (deploymentHosts), not the request's, so the static sites.json, llms.txt
 * and JSON-LD agree with them: { "except": ["cubby.pockethost.io"] } shows
 * the card there and nowhere else. Globs use "*" (globMatches). Fails
 * closed: any other value, "access" without an access block, or a
 * malformed rule object is 'hidden' (the build rejects all three anyway).
 * Pure, so Node tests and the build can call it.
 *
 * @param {object|null} manifest parsed cubby.json
 * @param {string[]} [hosts] the deployment's hostnames, from deploymentHosts
 * @returns {'public' | 'hidden' | 'access'}
 */
function parseVisibility(manifest, hosts) {
  if (!manifest || typeof manifest !== 'object') return 'hidden'
  const hidden = manifest.hidden
  if (hidden === undefined || hidden === null || hidden === false) return 'public'
  if (hidden === 'access' && parseAccess(manifest)) return 'access'
  if (hidden && typeof hidden === 'object' && !Array.isArray(hidden)) {
    if (domainRuleProblems(hidden).length) return 'hidden'
    const list = Array.isArray(hosts) ? hosts : []
    const matches = (globs) => list.some((host) => globs.some((glob) => globMatches(host, glob)))
    const targeted = hidden.on === undefined || matches(hidden.on)
    const excepted = hidden.except !== undefined && matches(hidden.except)
    return targeted && !excepted ? 'hidden' : 'public'
  }
  return 'hidden'
}

/**
 * Whether a signed-in email passes an access declaration: an empty
 * allowedUsers admits any signed-in user, otherwise one glob must match.
 * @param {{ allowedUsers: string[] } | null} access from parseAccess
 * @param {string} email
 */
function userAllowed(access, email) {
  if (!access || !email) return false
  if (!access.allowedUsers.length) return true
  return access.allowedUsers.some((glob) => emailMatches(email, glob))
}

module.exports = {
  loadCubbyConfig,
  resolveModel,
  loadAppAiPolicy,
  parseAiPolicy,
  globMatches,
  emailMatches,
  deploymentHosts,
  domainRuleProblems,
  parseAccess,
  parseVisibility,
  userAllowed,
}
