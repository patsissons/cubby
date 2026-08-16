/// <reference path="../.pb/pb_data/types.d.ts" />
// Platform: rooms transport collections backing cubby.rooms.
// Presence is one record per (room, user); events are fire-and-forget rows.
// Both are swept by pb_hooks/rooms.pb.js.
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id

    const presence = new Collection({
      type: 'base',
      name: 'rooms_presence',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule:
        "user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)",
      deleteRule: 'user = @request.auth.id',
      fields: [
        { name: 'room', type: 'text', required: true, max: 200 },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'state', type: 'json', maxSize: 100000 },
        { name: 'seen', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_rooms_presence_room_user` ON `rooms_presence` (`room`, `user`)',
        'CREATE INDEX `idx_rooms_presence_seen` ON `rooms_presence` (`seen`)',
      ],
    })
    app.save(presence)

    const events = new Collection({
      type: 'base',
      name: 'rooms_events',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'room', type: 'text', required: true, max: 200 },
        { name: 'event', type: 'text', required: true, max: 100 },
        { name: 'payload', type: 'json', maxSize: 100000 },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true },
      ],
      indexes: ['CREATE INDEX `idx_rooms_events_created` ON `rooms_events` (`created`)'],
    })
    app.save(events)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('rooms_events'))
    app.delete(app.findCollectionByNameOrId('rooms_presence'))
  }
)
