import { CubbyError, toCubbyError } from './errors.js'

/** Minimal extension to mime map for string writes. */
const MIME = {
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  csv: 'text/csv',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

/**
 * Normalize a storage path: strip leading slashes and ./, collapse
 * duplicate slashes, reject traversal and backslashes.
 * @param {string} path
 * @returns {string}
 */
export function normalizePath(path) {
  if (typeof path !== 'string' || !path.trim()) {
    throw new CubbyError('bad_path', 'path required')
  }
  const clean = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^(\.\/|\/)+/, '')
  if (!clean || clean.endsWith('/')) {
    throw new CubbyError('bad_path', `"${path}" does not name a file`)
  }
  if (clean.split('/').some((seg) => seg === '..' || seg === '.')) {
    throw new CubbyError('bad_path', `"${path}" contains traversal segments`)
  }
  return clean
}

/**
 * File storage facade over the shared root-level files collection.
 * Paths are always relative to the current app. Cross-app reads pass
 * { app: 'otherapp' } in options (every read method accepts it).
 *
 * @param {{app: string}} state
 * @param {import('pocketbase').default} pb
 */
export function createFs(state, pb) {
  const files = () => pb.collection('files')

  /** @param {{app?: string}} [opts] */
  function appOf(opts) {
    return opts?.app ? String(opts.app) : state.app
  }

  /**
   * @param {string} app
   * @param {string} path normalized path
   * @returns {Promise<object | null>} files record or null
   */
  async function find(app, path) {
    try {
      // requestKey: null disables the SDK's auto-cancellation, which would
      // otherwise abort one of two concurrent fs calls (e.g. two pasted
      // images uploading at once) because they share a collection+method.
      return await files().getFirstListItem(
        pb.filter('app = {:app} && path = {:path}', { app, path }),
        { requestKey: null }
      )
    } catch (err) {
      if (err && err.status === 404) return null
      throw toCubbyError(err)
    }
  }

  async function findOrThrow(app, path) {
    const record = await find(app, path)
    if (!record) throw new CubbyError('not_found', `${app}/${path} does not exist`)
    return record
  }

  /** @param {object} record @returns {string} direct PB file URL */
  function fileUrl(record) {
    return pb.files.getURL(record, record.file)
  }

  async function fetchFile(record) {
    const res = await fetch(fileUrl(record))
    if (!res.ok) throw new CubbyError('not_found', `file fetch failed with ${res.status}`, { status: res.status })
    return res
  }

  return {
    /**
     * Create or replace the file at path (upsert on (app, path)).
     * @param {string} path
     * @param {string | Blob | File} content
     * @returns {Promise<{path: string, size: number, updated: string, url: string}>}
     */
    async write(path, content) {
      const app = state.app
      const clean = normalizePath(path)
      const name = clean.split('/').pop()
      let blob
      if (typeof content === 'string') {
        const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : ''
        blob = new Blob([content], { type: MIME[ext] || 'text/plain' })
      } else {
        blob = content
      }
      const file = new File([blob], name, { type: blob.type || 'application/octet-stream' })

      try {
        const existing = await find(app, clean)
        const record = existing
          ? await files().update(existing.id, { file, size: file.size }, { requestKey: null })
          : await files().create({ app, path: clean, file, size: file.size }, { requestKey: null })
        // url comes for free here (the record is in hand) and saves the
        // caller a fs.url() round trip — pasted-image flows use it.
        return { path: clean, size: file.size, updated: record.updated, url: fileUrl(record) }
      } catch (err) {
        throw toCubbyError(err)
      }
    },

    /**
     * Read a file as a utf-8 string.
     * @param {string} path
     * @param {{app?: string}} [opts] cross-app read: { app: 'otherapp' }
     * @returns {Promise<string>}
     */
    async read(path, opts) {
      const record = await findOrThrow(appOf(opts), normalizePath(path))
      return (await fetchFile(record)).text()
    },

    /**
     * Read a file as a Blob.
     * @param {string} path
     * @param {{app?: string}} [opts]
     * @returns {Promise<Blob>}
     */
    async readBlob(path, opts) {
      const record = await findOrThrow(appOf(opts), normalizePath(path))
      return (await fetchFile(record)).blob()
    },

    /**
     * Direct PB file URL (usable in img src etc).
     * @param {string} path
     * @param {{app?: string}} [opts]
     * @returns {Promise<string>}
     */
    async url(path, opts) {
      const record = await findOrThrow(appOf(opts), normalizePath(path))
      return fileUrl(record)
    },

    /**
     * List files under a prefix.
     * @param {string} [prefix] e.g. 'notes/' (empty lists everything)
     * @param {{app?: string}} [opts]
     * @returns {Promise<Array<{path: string, size: number, updated: string}>>}
     */
    async list(prefix = '', opts) {
      const app = appOf(opts)
      let filter = pb.filter('app = {:app}', { app })
      if (prefix) {
        const clean = prefix.replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '')
        filter += ' && ' + pb.filter('path ~ {:prefix}', { prefix: `${clean}%` })
      }
      try {
        const records = await files().getFullList({ filter, sort: 'path', requestKey: null })
        return records.map((r) => ({ path: r.path, size: r.size || 0, updated: r.updated }))
      } catch (err) {
        throw toCubbyError(err)
      }
    },

    /**
     * Delete the file at path.
     * @param {string} path
     * @returns {Promise<void>}
     */
    async remove(path) {
      const record = await findOrThrow(state.app, normalizePath(path))
      try {
        await files().delete(record.id, { requestKey: null })
      } catch (err) {
        throw toCubbyError(err)
      }
    },
  }
}
