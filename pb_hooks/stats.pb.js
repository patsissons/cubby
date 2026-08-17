/// <reference path="../.pb/pb_data/types.d.ts" />
// Anonymous usage stats: POST /_cubby/stats/visit { app } bumps the app's
// visit counter. Counters live in app_usage, writable only here (system
// context), so clients cannot forge arbitrary rows or values. The
// foundation fires this automatically on app boot; no user data involved.
routerAdd('POST', '/_cubby/stats/visit', (e) => {
  let appName = ''
  try {
    appName = String(e.requestInfo().body?.app || '')
  } catch (err) {
    return e.json(400, { code: 'bad_request', message: 'invalid JSON body' })
  }

  if (!/^[a-z0-9-]{1,100}$/.test(appName)) {
    return e.json(400, { code: 'bad_request', message: 'invalid app name' })
  }

  // Only apps the discovery manifest knows about get rows.
  let known = false
  try {
    const sites = JSON.parse(toString($os.readFile(`${__hooks}/../pb_public/sites.json`)))
    known = sites.some((site) => site.name === appName)
  } catch (err) {
    known = false
  }
  if (!known) {
    return e.json(404, { code: 'not_found', message: 'unknown app' })
  }

  const now = new Date().toISOString().replace('T', ' ')
  let record
  try {
    record = e.app.findFirstRecordByFilter('app_usage', 'app = {:app}', { app: appName })
  } catch (err) {
    record = null
  }

  if (record) {
    record.set('visits', (record.getInt('visits') || 0) + 1)
    record.set('lastVisit', now)
  } else {
    const collection = e.app.findCollectionByNameOrId('app_usage')
    record = new Record(collection)
    record.set('app', appName)
    record.set('visits', 1)
    record.set('lastVisit', now)
  }
  e.app.save(record)

  return e.json(200, { ok: true })
})

// deploy nudge
