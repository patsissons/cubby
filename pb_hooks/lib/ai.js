// AI proxy request validation: message shape, content limits and options,
// checked against an app policy from config.js parseAiPolicy. Pure (no $app,
// no $os), so Node tests can call it. Each check returns the validated value,
// or { error: { status, body: { code, message } } } ready for e.json.

const ROLES = ['system', 'user', 'assistant']
const IMAGE_URL = /^data:image\/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/

const fail = (status, code, message) => ({ error: { status, body: { code, message } } })

/**
 * Validate messages and split each one's content into text and images.
 * Content is a string, or a non-empty array of parts:
 *   { type: 'text', text }
 *   { type: 'image_url', image_url: { url } } with a base64 data:image URL
 * Remote image URLs are rejected so the provider never fetches on our behalf.
 *
 * @param {unknown} messages
 * @returns {{ error: object } | { messages: Array<{role: string, content: string | object[], text: string, images: Array<{url: string, bytes: number}>}> }}
 */
function normalizeMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return fail(400, 'bad_request', 'messages array required')
  }
  const out = []
  for (const msg of messages) {
    if (!msg || !ROLES.includes(msg.role)) {
      return fail(400, 'bad_request', 'each message needs role (system|user|assistant) and content')
    }
    if (typeof msg.content === 'string') {
      out.push({ role: msg.role, content: msg.content, text: msg.content, images: [] })
      continue
    }
    if (!Array.isArray(msg.content) || msg.content.length === 0) {
      return fail(400, 'bad_request', 'message content must be a string or a non-empty array of parts')
    }
    const parts = []
    const texts = []
    const images = []
    for (const part of msg.content) {
      if (part && part.type === 'text' && typeof part.text === 'string') {
        parts.push({ type: 'text', text: part.text })
        texts.push(part.text)
        continue
      }
      const url = part && part.type === 'image_url' && part.image_url ? part.image_url.url : undefined
      const match = typeof url === 'string' ? IMAGE_URL.exec(url) : null
      if (!match) {
        return fail(
          400,
          'bad_request',
          'content parts are {type: "text", text} or {type: "image_url", image_url: {url}} with a base64 data:image/(jpeg|png|webp|gif) URL'
        )
      }
      const b64 = match[2]
      const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
      parts.push({ type: 'image_url', image_url: { url } })
      images.push({ url, bytes: Math.floor((b64.length * 3) / 4) - padding })
    }
    out.push({ role: msg.role, content: parts, text: texts.join('\n'), images })
  }
  return { messages: out }
}

/**
 * Enforce the policy's content limits, in order: image count, image size,
 * message count and text length (text only; image bytes have their own
 * cap), then per-role patterns against each message's joined text.
 *
 * @param {Array<{role: string, text: string, images: Array<{bytes: number}>}>} messages from normalizeMessages
 * @param {object} policy from parseAiPolicy
 * @param {string} appName for error messages
 * @returns {{ error: object } | null}
 */
function checkContent(messages, policy, appName) {
  const images = messages.reduce((all, msg) => all.concat(msg.images), [])
  if (images.length > policy.maxImages) {
    return fail(
      403,
      'images_not_allowed',
      policy.maxImages
        ? `app "${appName}" allows at most ${policy.maxImages} image(s) per request`
        : `app "${appName}" does not accept images (add "maxImages" to its cubby.json ai block)`
    )
  }
  if (images.some((image) => image.bytes > policy.maxImageBytes)) {
    return fail(413, 'image_too_large', `images must be at most ${policy.maxImageBytes} bytes`)
  }

  let totalChars = 0
  for (const msg of messages) totalChars += msg.text.length
  if (messages.length > policy.maxMessages || (policy.maxChars > 0 && totalChars > policy.maxChars)) {
    return fail(
      413,
      'content_too_long',
      `input exceeds the app's limits (max ${policy.maxMessages} messages, ${policy.maxChars} chars)`
    )
  }

  // When patterns are declared, every message's role needs an entry;
  // unlisted roles are rejected so nothing can be smuggled through an
  // unconstrained role.
  if (policy.messagePatterns) {
    for (const msg of messages) {
      const entry = policy.messagePatterns[msg.role]
      const patterns = Array.isArray(entry) ? entry : entry !== undefined ? [entry] : []
      const ok = patterns.some((pattern) => {
        try {
          return typeof pattern === 'string' && new RegExp(pattern).test(msg.text)
        } catch (err) {
          return false
        }
      })
      if (!ok) {
        return fail(403, 'content_not_allowed', `app "${appName}" does not permit this ${msg.role} message content`)
      }
    }
  }
  return null
}

/**
 * Resolve the caller's options against the policy into a fresh object, so
 * unknown keys never reach the provider. maxTokens is clamped to the app's
 * cap; reasoning must be an allowed effort level; webSearch must be enabled,
 * and its maxResults is clamped to the app's cap.
 *
 * @param {unknown} options
 * @param {object} policy from parseAiPolicy
 * @param {string} appName for error messages
 * @returns {{ error: object } | { options: {maxTokens: number, temperature?: number, reasoning?: string, webSearch?: {maxResults: number}} }}
 */
function resolveOptions(options, policy, appName) {
  const input = options && typeof options === 'object' ? options : {}
  const out = {
    maxTokens: Math.min(
      typeof input.maxTokens === 'number' && input.maxTokens > 0 ? input.maxTokens : policy.maxTokens,
      policy.maxTokens
    ),
  }
  if (typeof input.temperature === 'number') out.temperature = input.temperature

  if (input.reasoning !== undefined && input.reasoning !== null && input.reasoning !== false) {
    if (typeof input.reasoning !== 'string' || !policy.reasoning.includes(input.reasoning)) {
      return fail(
        403,
        'option_not_allowed',
        policy.reasoning.length
          ? `app "${appName}" allows reasoning effort: ${policy.reasoning.join(', ')}`
          : `app "${appName}" does not allow reasoning (add "reasoning" to its cubby.json ai block)`
      )
    }
    out.reasoning = input.reasoning
  }

  if (input.webSearch !== undefined && input.webSearch !== null && input.webSearch !== false) {
    if (!policy.webSearch) {
      return fail(
        403,
        'option_not_allowed',
        `app "${appName}" does not allow web search (add "webSearch" to its cubby.json ai block)`
      )
    }
    const cap = policy.webSearch.maxResults
    const asked = input.webSearch && typeof input.webSearch.maxResults === 'number' ? input.webSearch.maxResults : cap
    out.webSearch = { maxResults: Math.max(1, Math.min(cap, Math.floor(asked))) }
  }
  return { options: out }
}

module.exports = { normalizeMessages, checkContent, resolveOptions }
