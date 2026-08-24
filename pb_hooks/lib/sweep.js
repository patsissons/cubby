// Rooms sweeper: deletes stale presence (crashed clients) and old events.
// Deleting via app.delete fires realtime delete events, which is what emits
// user.leave to subscribed clients.

const PRESENCE_TTL_MS = 60 * 1000
// Events are a broadcast bus, not a log: nothing ever reads them back (clients
// subscribe to create only, so a late joiner sees nothing). Two minutes is
// generous headroom over any in-flight delivery.
const EVENTS_TTL_MS = 2 * 60 * 1000
// The cron runs once a minute, so BATCH is a deletion RATE: 1000/min is ~16/s.
// /js/draw.js sends one event per time-boxed stroke segment, roughly 1/s per
// person actively drawing, so this carries a dozen simultaneous drawers with
// room to spare. At the old 200 it was ~3/s and three drawers outran it, after
// which the table grows without bound.
const BATCH = 1000

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
