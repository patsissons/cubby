import { CubbyError } from '#core'

/**
 * AI chat via the server-side proxy at /_cubby/ai/chat. Non-streaming by
 * design: the PocketHost JSVM cannot stream responses. Models are config
 * registry aliases (cubby.config.json ai.models); provider API keys live in
 * instance env vars and never reach the client.
 *
 * Usage costs real money, so the proxy enforces each app's policy from its
 * committed cubby.json "ai" block: a models allowlist (empty by default,
 * which blocks AI entirely), signed-in users only unless allowAnonymous,
 * and a per-caller rate limit (default 1 prompt per 60s). Images,
 * reasoning and web search are further opt-ins (maxImages, reasoning,
 * webSearch). Expect and handle the codes: model_not_allowed,
 * auth_required, rate_limited (carries .retryAfter seconds),
 * provider_unconfigured, images_not_allowed, image_too_large,
 * option_not_allowed.
 *
 * @param {{app: string, config: {ai?: {defaultModel?: string, models?: object}} | null, baseUrl: string}} state
 * @param {import('pocketbase').default} pb
 */
export function createAi(state, pb) {
  return {
    /**
     * Send a chat request. content is a string, or an array of parts:
     * {type: 'text', text} and image parts from imagePart(). reasoning is
     * an effort level ('high', ...) the app's policy allows; its tokens
     * count against maxTokens. webSearch (true or {maxResults}) adds web
     * results, cited in the response's citations.
     * @param {{
     *   messages: Array<{role: 'system' | 'user' | 'assistant', content: string | Array<{type: 'text', text: string} | {type: 'image_url', image_url: {url: string}}>}>,
     *   model?: string,
     *   options?: {maxTokens?: number, temperature?: number, reasoning?: string, webSearch?: boolean | {maxResults?: number}},
     * }} request
     * @returns {Promise<{text: string, usage: {input: number, output: number, reasoning: number}, citations: Array<{url: string, title: string}>, model: string, provider: string}>}
     */
    async chat({ messages, model, options } = {}) {
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new CubbyError('bad_request', 'messages array required')
      }

      const registry = state.config?.ai?.models || {}
      const alias = model || state.config?.ai?.defaultModel
      if (!alias || !registry[alias]) {
        throw new CubbyError(
          'model_unknown',
          `unknown model alias "${alias}" (have: ${Object.keys(registry).join(', ') || 'none'})`
        )
      }

      const headers = { 'Content-Type': 'application/json' }
      if (pb.authStore.isValid) headers.Authorization = pb.authStore.token

      const res = await fetch(`${state.baseUrl || ''}/_cubby/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ app: state.app, model: alias, messages, options: options || {} }),
      })

      let body
      try {
        body = await res.json()
      } catch {
        throw new CubbyError('provider_error', `AI proxy returned a non-JSON ${res.status} response`, {
          status: res.status,
        })
      }
      if (!res.ok) {
        const err = new CubbyError(body.code || 'provider_error', body.message || `AI proxy failed with ${res.status}`, {
          status: res.status,
        })
        if (typeof body.retryAfter === 'number') err.retryAfter = body.retryAfter
        throw err
      }
      return body
    },

    /**
     * Turn an image File or Blob into a chat content part: decoded with
     * EXIF orientation applied, scaled so its longest edge is at most
     * maxEdge (never up), flattened onto white, and encoded as a JPEG data
     * URL. Browser only.
     * @param {Blob} fileOrBlob
     * @param {{maxEdge?: number, quality?: number}} [opts]
     * @returns {Promise<{type: 'image_url', image_url: {url: string}}>}
     */
    async imagePart(fileOrBlob, { maxEdge = 1600, quality = 0.85 } = {}) {
      let bitmap
      try {
        bitmap = await createImageBitmap(fileOrBlob, { imageOrientation: 'from-image' })
      } catch (err) {
        throw new CubbyError('bad_request', `could not decode image: ${err.message || err}`)
      }
      try {
        const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bitmap.width * scale))
        canvas.height = Math.max(1, Math.round(bitmap.height * scale))
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        return { type: 'image_url', image_url: { url: canvas.toDataURL('image/jpeg', quality) } }
      } finally {
        bitmap.close()
      }
    },
  }
}
