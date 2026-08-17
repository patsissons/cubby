/// <reference path="../.pb/pb_data/types.d.ts" />
// AI proxy: POST /_cubby/ai/chat with { app, model?, messages, options? }.
// AI usage costs real money, so policy is enforced here, server-side, from
// the calling app's committed manifest (cubby.json "ai" block):
//   - models: allowlist of registry aliases; DEFAULT [] blocks AI entirely
//   - allowAnonymous: default false (signed-in users only)
//   - rateLimitSeconds: min seconds between prompts per caller; default 60
// Rate stamps live in the hook-only ai_rate collection, keyed per app plus
// user id (or client IP for anonymous-enabled apps). The app name is the
// caller's claim; every allowlist still comes from a manifest the operator
// committed, so a forged claim can only reach models some app already allows.
// Non-streaming by design: the JSVM buffers whole responses.
routerAdd('POST', '/_cubby/ai/chat', (e) => {
  const { resolveModel, loadAppAiPolicy } = require(`${__hooks}/lib/config.js`)
  const { buildRequest, parseResponse } = require(`${__hooks}/lib/providers.js`)

  let body
  try {
    body = e.requestInfo().body || {}
  } catch (err) {
    return e.json(400, { code: 'bad_request', message: 'invalid JSON body' })
  }

  const appName = String(body.app || '')
  if (!/^[a-z0-9_-]{1,100}$/.test(appName)) {
    return e.json(400, { code: 'bad_request', message: 'app name required' })
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

  const policy = loadAppAiPolicy(appName)

  let model
  try {
    model = resolveModel(body.model)
  } catch (err) {
    return e.json(err.status || 500, { code: err.code || 'provider_error', message: err.message || String(err) })
  }

  if (!policy.models.includes(model.alias)) {
    return e.json(403, {
      code: 'model_not_allowed',
      message: policy.models.length
        ? `app "${appName}" allows only: ${policy.models.join(', ')}`
        : `app "${appName}" does not declare any AI models (add an "ai" block with a models allowlist to its cubby.json)`,
    })
  }

  if (!e.auth && !policy.allowAnonymous) {
    return e.json(401, { code: 'auth_required', message: 'sign in to use the AI proxy' })
  }

  // Identity ACL: when the app lists allowedUsers, the caller must be
  // signed in and their email must match one of the globs.
  if (policy.allowedUsers.length) {
    const { emailMatches } = require(`${__hooks}/lib/config.js`)
    const email = e.auth ? e.auth.getString('email') : ''
    if (!email || !policy.allowedUsers.some((glob) => emailMatches(email, glob))) {
      return e.json(403, {
        code: 'user_not_allowed',
        message: `app "${appName}" restricts AI usage to specific users`,
      })
    }
  }

  // Content limits: size first, then per-role patterns. When patterns are
  // declared, every message's role needs an entry; unlisted roles are
  // rejected so nothing can be smuggled through an unconstrained role.
  let totalChars = 0
  for (const msg of messages) totalChars += msg.content.length
  if (messages.length > policy.maxMessages || (policy.maxChars > 0 && totalChars > policy.maxChars)) {
    return e.json(413, {
      code: 'content_too_long',
      message: `input exceeds the app's limits (max ${policy.maxMessages} messages, ${policy.maxChars} chars)`,
    })
  }
  if (policy.messagePatterns) {
    for (const msg of messages) {
      const pattern = policy.messagePatterns[msg.role]
      let ok = false
      try {
        ok = typeof pattern === 'string' && new RegExp(pattern).test(msg.content)
      } catch (err) {
        ok = false
      }
      if (!ok) {
        return e.json(403, {
          code: 'content_not_allowed',
          message: `app "${appName}" does not permit this ${msg.role} message content`,
        })
      }
    }
  }

  // Rate limit per caller. Counting attempts (stamped before the provider
  // call) keeps failed calls from becoming a free retry loop.
  if (policy.rateLimitSeconds > 0) {
    const caller = e.auth ? e.auth.id : `ip:${e.realIP()}`
    const key = `${appName}:${caller}`
    const now = Date.now()
    let stamp
    try {
      stamp = e.app.findFirstRecordByFilter('ai_rate', 'key = {:key}', { key })
    } catch (err) {
      stamp = null
    }
    if (stamp) {
      const last = new Date(String(stamp.getString('last')).replace(' ', 'T')).getTime()
      const waitMs = policy.rateLimitSeconds * 1000 - (now - last)
      if (waitMs > 0) {
        const retryAfter = Math.ceil(waitMs / 1000)
        return e.json(429, {
          code: 'rate_limited',
          retryAfter,
          message: `rate limited: try again in ${retryAfter}s`,
        })
      }
      stamp.set('last', new Date(now).toISOString().replace('T', ' '))
      stamp.set('count', (stamp.getInt('count') || 0) + 1)
    } else {
      const collection = e.app.findCollectionByNameOrId('ai_rate')
      stamp = new Record(collection)
      stamp.set('key', key)
      stamp.set('last', new Date(now).toISOString().replace('T', ' '))
      stamp.set('count', 1)
    }
    e.app.save(stamp)
  }

  // Key validation and provider translation come after policy so missing
  // keys cannot bypass the rate stamp. options.maxTokens is a cost lever,
  // so clamp it to the app's cap.
  const options = body.options && typeof body.options === 'object' ? body.options : {}
  options.maxTokens = Math.min(
    typeof options.maxTokens === 'number' && options.maxTokens > 0 ? options.maxTokens : policy.maxTokens,
    policy.maxTokens
  )
  let request
  try {
    request = buildRequest(model, messages, options)
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
