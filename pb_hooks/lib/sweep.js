// Rooms sweeper: deletes stale presence (crashed clients) and old events.
// Deleting via app.delete fires realtime delete events, which is what emits
// user.leave to subscribed clients.

const PRESENCE_TTL_MS = 60 * 1000
const EVENTS_TTL_MS = 10 * 60 * 1000
const BATCH = 200

/** Format a cutoff as PB's stored UTC date format (space separator). */
function cutoff(msAgo) {
  return new Date(Date.now() - msAgo).toISOString().replace('T', ' ')
}

/**
 * @param {core.App} app
 * @returns {{presence: number, events: number}} deletion counts
 */
function sweepRooms(app) {
  let presence = 0
  let events = 0

  const stale = app.findRecordsByFilter(
    'rooms_presence',
    'seen < {:cutoff}',
    '',
    BATCH,
    0,
    { cutoff: cutoff(PRESENCE_TTL_MS) }
  )
  for (const record of stale) {
    app.delete(record)
    presence++
  }

  const old = app.findRecordsByFilter(
    'rooms_events',
    'created < {:cutoff}',
    '',
    BATCH,
    0,
    { cutoff: cutoff(EVENTS_TTL_MS) }
  )
  for (const record of old) {
    app.delete(record)
    events++
  }

  return { presence, events }
}

module.exports = { sweepRooms }
