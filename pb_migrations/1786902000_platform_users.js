/// <reference path="../.pb/pb_data/types.d.ts" />
// Platform: configure the default users auth collection for OAuth2-only login.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // Login state is shared across every app on the origin; profiles are
    // readable by any signed-in user so rooms and apps can render names.
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"

    users.passwordAuth.enabled = false
    users.oauth2.enabled = true

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.passwordAuth.enabled = true
    users.oauth2.enabled = false
    app.save(users)
  }
)
