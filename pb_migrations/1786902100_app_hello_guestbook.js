/// <reference path="../.pb/pb_data/types.d.ts" />
// App migration for hello: the realtime guestbook.
// App collections use the <app>_<name> convention and app_<app>_ file prefixes
// so downstream deployments never collide with platform migrations.
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId('users').id

    const collection = new Collection({
      type: 'base',
      name: 'hello_guestbook',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != '' && @request.body.user = @request.auth.id",
      updateRule: null,
      deleteRule: 'user = @request.auth.id',
      fields: [
        { name: 'message', type: 'text', required: true, max: 500 },
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
      indexes: ['CREATE INDEX `idx_hello_guestbook_created` ON `hello_guestbook` (`created`)'],
    })
    app.save(collection)
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId('hello_guestbook'))
  }
)
