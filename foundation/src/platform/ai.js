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
 * and a per-caller rate limit (default 1 prompt per 60s). Expect and
 * handle the codes: model_not_allowed, auth_required, rate_limited
 * (carries .retryAfter seconds), provider_unconfigured.
 *
 * @param {{app: string, config: {ai?: {defaultModel?: string, models?: object}} | null, baseUrl: string}} state
 * @param {import('pocketbase').default} pb
 */
export function createAi(state, pb) {
  return {
    /**
     * Send a chat request.
     * @param {{
     *   messages: Array<{role: 'system' | 'user' | 'assistant', content: string}>,
     *   model?: string,
     *   options?: {maxTokens?: number, temperature?: number},
     * }} request
     * @returns {Promise<{text: string, usage: {input: number, output: number}, model: string, provider: string}>}
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
  }
}
