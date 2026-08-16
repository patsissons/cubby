/// <reference path="../.pb/pb_data/types.d.ts" />
// AI proxy: POST /_cubby/ai/chat. Authenticated clients send
// { model?, messages, options? }; the hook resolves the model alias from the
// shared registry, calls the provider with the instance env var key, and
// normalizes the response to { text, usage, model, provider }.
// Non-streaming by design: the JSVM buffers whole responses.
routerAdd('POST', '/_cubby/ai/chat', (e) => {
  if (!e.auth) {
    return e.json(401, { code: 'auth_required', message: 'sign in to use the AI proxy' })
  }

  const { resolveModel } = require(`${__hooks}/lib/config.js`)
  const { buildRequest, parseResponse } = require(`${__hooks}/lib/providers.js`)

  let body
  try {
    body = e.requestInfo().body || {}
  } catch (err) {
    return e.json(400, { code: 'bad_request', message: 'invalid JSON body' })
  }

  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    return e.json(400, { code: 'bad_request', message: 'messages array required' })
  }
  for (const msg of messages) {
    if (!msg || typeof msg.content !== 'string' || !['system', 'user', 'assistant'].includes(msg.role)) {
      return e.json(400, {
        code: 'bad_request',
        message: 'each message needs role (system|user|assistant) and string content',
      })
    }
  }

  let model
  let request
  try {
    model = resolveModel(body.model)
    request = buildRequest(model, messages, body.options || {})
  } catch (err) {
    return e.json(err.status || 500, { code: err.code || 'provider_error', message: err.message || String(err) })
  }

  let res
  try {
    res = $http.send({
      url: request.url,
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
      timeout: 60,
    })
  } catch (err) {
    return e.json(502, { code: 'provider_error', message: `provider request failed: ${err.message || err}` })
  }

  if (res.statusCode < 200 || res.statusCode >= 300) {
    let detail = ''
    try {
      const errJson = res.json
      detail = (errJson.error && (errJson.error.message || errJson.error.type)) || errJson.message || ''
    } catch (err) {
      detail = ''
    }
    return e.json(502, {
      code: 'provider_error',
      message: `${model.provider} returned ${res.statusCode}${detail ? `: ${detail}` : ''}`,
    })
  }

  try {
    return e.json(200, parseResponse(model, res.json))
  } catch (err) {
    return e.json(502, { code: 'provider_error', message: `could not parse ${model.provider} response` })
  }
})
