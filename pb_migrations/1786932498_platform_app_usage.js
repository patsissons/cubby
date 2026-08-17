/// <reference path="../.pb/pb_data/types.d.ts" />
// Platform: anonymous per-app usage counters backing the discovery site's
// popularity and recently-used sorting. Rows are written only by the
// stats hook (system context); clients can read, never write.
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'app_usage',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'app', type: 'text', required: true, max: 100 },
        { name: 'visits', type: 'number', onlyInt: true, min: 0 },
        { name: 'lastVisit', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_app_usage_app` ON `app_usage` (`app`)'],
    })
    app.save(collection)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('app_usage'))
  }
)

// deploy nudge
