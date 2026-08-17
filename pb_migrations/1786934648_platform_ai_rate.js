/// <reference path="../.pb/pb_data/types.d.ts" />
// Platform: AI rate-limit stamps, one row per (app, caller) with the last
// request time and a lifetime counter. Written and read only by the AI
// proxy hook (system context); clients have no access at all.
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'ai_rate',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'key', type: 'text', required: true, max: 300 },
        { name: 'last', type: 'date', required: true },
        { name: 'count', type: 'number', onlyInt: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_ai_rate_key` ON `ai_rate` (`key`)'],
    })
    app.save(collection)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('ai_rate'))
  }
)
