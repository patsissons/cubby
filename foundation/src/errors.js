/**
 * Error type thrown by every cubby foundation method.
 *
 * Known codes: auth_required, not_found, bad_path, model_unknown,
 * provider_unconfigured, provider_error, config_unavailable, bad_request.
 */
export class CubbyError extends Error {
  /**
   * @param {string} code machine-readable error code
   * @param {string} [message] human-readable detail
   * @param {{cause?: unknown, status?: number}} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message || code)
    this.name = 'CubbyError'
    this.code = code
    if (extra.status) this.status = extra.status
    if (extra.cause) this.cause = extra.cause
  }
}

/**
 * Wrap an unknown thrown value into a CubbyError, preserving CubbyErrors as-is.
 * @param {unknown} err
 * @param {string} fallbackCode
 * @returns {CubbyError}
 */
export function toCubbyError(err, fallbackCode = 'unknown') {
  if (err instanceof CubbyError) return err
  const status = err && typeof err === 'object' && 'status' in err ? err.status : undefined
  if (status === 401 || status === 403) {
    return new CubbyError('auth_required', String(err?.message || err), { cause: err, status })
  }
  if (status === 404) {
    return new CubbyError('not_found', String(err?.message || err), { cause: err, status })
  }
  return new CubbyError(fallbackCode, String(err?.message || err), { cause: err, status })
}
