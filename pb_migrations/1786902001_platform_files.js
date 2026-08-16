/// <reference path="../.pb/pb_data/types.d.ts" />
// Platform: shared file storage backing cubby.fs. One record per (app, path).
migrate(
  (app) => {
    const collection = new Collection({
      type: 'base',
      name: 'files',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'app', type: 'text', required: true, max: 100 },
        { name: 'path', type: 'text', required: true, max: 500 },
        { name: 'file', type: 'file', required: true, maxSelect: 1, maxSize: 10485760 },
        { name: 'size', type: 'number', onlyInt: true, min: 0 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX `idx_files_app_path` ON `files` (`app`, `path`)'],
    })
    app.save(collection)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('files'))
  }
)
