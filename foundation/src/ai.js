import { CubbyError } from './errors.js'

/**
 * AI chat via the server-side proxy at /_cubby/ai/chat. Non-streaming by
 * design: the PocketHost JSVM cannot stream responses. Models are config
 * registry aliases (cubby.config.json ai.models); provider API keys live in
 * instance env vars and never reach the client.
 *
 * @param {{config: {ai?: {defaultModel?: string, models?: object}} | null, baseUrl: string}} state
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
      if (!pb.authStore.isValid) {
        throw new CubbyError('auth_required', 'sign in before using cubby.ai')
      }

      const registry = state.config?.ai?.models || {}
      const alias = model || state.config?.ai?.defaultModel
      if (!alias || !registry[alias]) {
        throw new CubbyError(
          'model_unknown',
          `unknown model alias "${alias}" (have: ${Object.keys(registry).join(', ') || 'none'})`
        )
      }

      const res = await fetch(`${state.baseUrl || ''}/_cubby/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({ model: alias, messages, options: options || {} }),
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
        throw new CubbyError(body.code || 'provider_error', body.message || `AI proxy failed with ${res.status}`, {
          status: res.status,
        })
      }
      return body
    },
  }
}
