/// <reference path="../.pb/pb_data/types.d.ts" />
// Rooms sweeper wiring. The sweep itself lives in lib/sweep.js and runs two
// ways because PocketHost hibernates idle instances (cronAdd alone is
// unreliable there):
//  1. cronAdd: fires while the instance is awake (and always in local dev).
//     A hibernating instance has no connected room clients, so missed ticks
//     are harmless; stale rows are cleared on the next tick after wake.
//  2. GET /_cubby/cron/sweep: for a PocketHost dashboard webhook (e.g.
//     @minutely) or manual poke. Idempotent and cheap, so it is unauthenticated.

cronAdd('cubbyRoomsSweep', '* * * * *', () => {
  const { sweepRooms } = require(`${__hooks}/lib/sweep.js`)
  const swept = sweepRooms($app)
  if (swept.presence || swept.events) {
    console.log(`[cubby] rooms sweep: ${swept.presence} presence, ${swept.events} events`)
  }
})

routerAdd('GET', '/_cubby/cron/sweep', (e) => {
  const { sweepRooms } = require(`${__hooks}/lib/sweep.js`)
  const swept = sweepRooms(e.app)
  return e.json(200, { ok: true, swept })
})
