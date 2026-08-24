import { CubbyError } from './errors.js'

/**
 * The widget lifecycle contract: every cubby widget is
 * `f(target, options) -> handle`, and every handle has a `destroy()` that
 * removes the markup, the listeners and the state it added. Without that,
 * nothing is testable in isolation or swappable at runtime.
 *
 * This helper exists so each widget does not re-implement listener
 * bookkeeping and idempotent teardown, and so `destroy()` cannot quietly
 * forget one of the three.
 */

/**
 * Resolve a mount target. A string goes through querySelector; anything else
 * is used as-is, which keeps this function DOM-free for callers that pass an
 * element (and makes the helper unit-testable under plain Node with a stub).
 * @param {string|object} target
 * @returns {object}
 */
function resolveTarget(target) {
  if (typeof target === 'string') {
    if (typeof document === 'undefined') {
      throw new CubbyError('bad_request', 'a selector target needs a DOM')
    }
    const found = document.querySelector(target)
    if (!found) throw new CubbyError('not_found', `no element matches "${target}"`)
    return found
  }
  if (!target) throw new CubbyError('bad_request', 'a mount target is required')
  return target
}

/**
 * Wrap a widget factory in the standard lifecycle.
 *
 * The factory receives `(ctx, element, options)` and returns the widget's own
 * handle. `ctx.on()` registers a listener and its removal in one step;
 * `ctx.own()` takes any teardown thunk (a timer, an observer, a subscription).
 *
 * @param {string} name widget name, used in error messages
 * @param {(ctx: object, element: object, options: object) => object} factory
 * @returns {(target: string|object, options?: object) => object}
 */
export function widget(name, factory) {
  return function mount(target, options = {}) {
    const element = resolveTarget(target)
    /** @type {Array<() => void>} teardown thunks, run in reverse */
    const cleanups = []

    const ctx = {
      element,
      /** Add a listener and remember how to remove it. */
      on(node, type, fn, opts) {
        node.addEventListener(type, fn, opts)
        cleanups.push(() => node.removeEventListener(type, fn, opts))
        return fn
      },
      /** Register an arbitrary teardown thunk. */
      own(fn) {
        cleanups.push(fn)
        return fn
      },
    }

    let handle
    try {
      handle = factory(ctx, element, options) || {}
    } catch (err) {
      // A factory that throws half-way has still registered listeners; tear
      // them down before rethrowing so a failed mount leaves nothing behind.
      runCleanups(cleanups, name)
      throw err
    }

    let destroyed = false

    // Copy property DESCRIPTORS, not values. A spread would evaluate the
    // factory's getters once and freeze the results as plain properties --
    // which silently breaks the commonest handle shape there is, a live
    // `value` accessor over an input element.
    const api = Object.defineProperties({}, Object.getOwnPropertyDescriptors(handle))

    // element, destroyed and destroy are the contract and are applied LAST,
    // so they win over anything the factory returned under those names.
    // `element` is always the mount target -- a widget with a second
    // interesting node must give it a different name.
    return Object.defineProperties(api, {
      element: { enumerable: true, value: element },
      destroyed: {
        enumerable: true,
        get: () => destroyed,
      },
      /** Idempotent: calling it twice is a no-op, never a double-teardown. */
      destroy: {
        enumerable: true,
        value: () => {
          if (destroyed) return
          destroyed = true
        // The widget's own teardown runs first, while its listeners are still
        // attached — it may need to emit a final event or restore the DOM.
          if (typeof handle.destroy === 'function') {
            try {
              handle.destroy()
            } catch (err) {
              console.error(`[cubby.${name}] destroy threw:`, err)
            }
          }
          runCleanups(cleanups, name)
        },
      },
    })
  }
}

/** Run teardown in reverse registration order; one failure never blocks the rest. */
function runCleanups(cleanups, name) {
  while (cleanups.length) {
    const fn = cleanups.pop()
    try {
      fn()
    } catch (err) {
      console.error(`[cubby.${name}] cleanup threw:`, err)
    }
  }
}
