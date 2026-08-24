// Shared jsdom harness for widget tests.
//
// Loads the real built IIFE bundles into a jsdom window, in the same order a
// page's <script defer> tags would, so what is under test is the shipped
// artifact and its documented load contract -- not the source, and not a
// hand-rolled approximation of it.
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const bundle = (file) => readFileSync(path.join(root, 'pb_public/js', file), 'utf8')

/**
 * Build a page with cubby loaded.
 * @param {{html?: string, scripts?: string[], url?: string, platform?: object}} opts
 *   platform: a stub namespace merged in AFTER the bundles, so a widget can be
 *   tested with a backend present without standing up PocketBase.
 */
export function page({ html = '', scripts = ['core.js'], url = 'https://cubby.test/app/', platform } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  })
  const { window } = dom
  const errors = []
  const warnings = []
  window.console = { ...console, error: (...a) => errors.push(a.join(' ')), warn: (...a) => warnings.push(a.join(' ')) }

  installIntersectionObserver(window)

  for (const file of scripts) window.eval(bundle(file))

  if (platform && window.cubby) {
    Object.assign(window.cubby, platform)
    // hasPlatform() closes over the namespace, so the stub takes effect for free.
  }

  return {
    dom,
    window,
    document: window.document,
    get cubby() {
      return window.cubby
    },
    errors,
    warnings,
    /** Every style cubby injected, in document order. */
    injectedStyles: () => [...window.document.head.querySelectorAll('style[data-cubby-markdown], style[data-cubby-tokens], style[data-cubby-nav], style[data-cubby-preview]')],
  }
}

/**
 * jsdom ships no IntersectionObserver. This stub records its observers and
 * lets a test drive entries by hand, which is the only way to exercise
 * scroll-position logic deterministically.
 */
function installIntersectionObserver(window) {
  const instances = []
  window.IntersectionObserver = class {
    constructor(callback, options = {}) {
      this.callback = callback
      this.options = options
      this.observed = new Set()
      instances.push(this)
    }
    observe(el) {
      this.observed.add(el)
    }
    unobserve(el) {
      this.observed.delete(el)
    }
    disconnect() {
      this.observed.clear()
      this.disconnected = true
    }
    /** Test hook: deliver entries as the real observer would. */
    fire(entries) {
      this.callback(
        entries.map((e) => ({ isIntersecting: true, intersectionRatio: 1, ...e })),
        this
      )
    }
  }
  window.__observers = instances
}

export { bundle }
