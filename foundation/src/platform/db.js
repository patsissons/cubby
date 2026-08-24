import { CubbyError } from '#core'

const COLLECTION_RE = /^[a-z0-9_]+$/
const APP_RE = /^[a-z0-9_-]+$/

/**
 * Map an app name to its collection prefix. App directory names allow hyphens
 * but PocketBase collection names do not, so hyphens become underscores:
 * app "my-app", collection "items" -> "my_app_items".
 * @param {string} app
 * @returns {string}
 */
export function collectionPrefix(app) {
  return app.replace(/-/g, '_')
}

/**
 * Database facade. cubby.db.collection('items') returns the PocketBase SDK
 * collection for '<app>_items', preserving the full PB API (getList,
 * getFullList, create, update, delete, subscribe). The slash form
 * 'otherapp/items' reads another app's collection. Writing outside your own
 * prefix is a convention violation, not an enforcement.
 *
 * @param {{app: string}} state shared foundation state
 * @param {import('pocketbase').default} pb shared PocketBase client
 */
export function createDb(state, pb) {
  /**
   * @param {string} name 'items' or 'otherapp/items'
   * @returns {string} full collection name
   */
  function resolve(name) {
    if (typeof name !== 'string' || !name) {
      throw new CubbyError('bad_request', 'collection name required')
    }
    let app = state.app
    let collection = name
    if (name.includes('/')) {
      const parts = name.split('/')
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new CubbyError('bad_request', `invalid collection reference "${name}"`)
      }
      ;[app, collection] = parts
    }
    if (!APP_RE.test(app)) {
      throw new CubbyError('bad_request', `invalid app name "${app}"`)
    }
    if (!COLLECTION_RE.test(collection)) {
      throw new CubbyError('bad_request', `invalid collection name "${collection}"`)
    }
    return `${collectionPrefix(app)}_${collection}`
  }

  return {
    /**
     * @param {string} name short collection name, or 'otherapp/name'
     * @returns {import('pocketbase').RecordService}
     */
    collection(name) {
      return pb.collection(resolve(name))
    },
    /** The underlying PocketBase SDK client. */
    get raw() {
      return pb
    },
  }
}
