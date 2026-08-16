import { CubbyError, toCubbyError } from './errors.js'

/**
 * OAuth2-only identity. Login state is stored in the PB SDK's localStorage
 * auth store, so it is shared across every app on the origin automatically.
 *
 * @param {{config: {oauthProviders?: string[]} | null}} state
 * @param {import('pocketbase').default} pb
 */
export function createIdentity(state, pb) {
  /** @returns {object | null} the signed-in user record, or null */
  function current() {
    return pb.authStore.isValid ? pb.authStore.record : null
  }

  /** @type {Set<(user: object | null) => void>} */
  const listeners = new Set()
  pb.authStore.onChange(() => {
    for (const listener of listeners) listener(current())
  })

  const identity = {
    /**
     * Sign in with an OAuth2 provider via the PB popup flow.
     * @param {string} provider e.g. 'google' or 'github'
     * @returns {Promise<object>} the signed-in user record
     */
    async login(provider) {
      const allowed = state.config?.oauthProviders
      if (allowed && allowed.length && !allowed.includes(provider)) {
        throw new CubbyError('bad_request', `provider "${provider}" is not configured (have: ${allowed.join(', ')})`)
      }
      try {
        await pb.collection('users').authWithOAuth2({ provider })
      } catch (err) {
        throw toCubbyError(err, 'auth_required')
      }
      return current()
    },
    /** Sign out everywhere on this origin. */
    async logout() {
      pb.authStore.clear()
    },
    /** The signed-in user record, or null. */
    get user() {
      return current()
    },
  }

  /**
   * Subscribe to identity changes. Fires immediately with the current state.
   * @param {(user: object | null) => void} fn
   * @returns {() => void} unsubscribe
   */
  function identityChanged(fn) {
    listeners.add(fn)
    fn(current())
    return () => listeners.delete(fn)
  }

  return { identity, identityChanged }
}
