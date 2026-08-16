// Provider request builders and response parsers for the AI proxy.
// Each provider is called non-streaming via $http.send and normalized to
// { text, usage: {input, output}, model, provider }.

const ENV_KEYS = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
}

/** Split messages into system text and non-system turns. */
function splitSystem(messages) {
  const system = []
  const turns = []
  for (const msg of messages) {
    if (msg.role === 'system') system.push(msg.content)
    else turns.push(msg)
  }
  return { system: system.join('\n\n'), turns }
}

/**
 * @param {{alias: string, provider: string, id: string}} model
 * @param {Array<{role: string, content: string}>} messages
 * @param {{maxTokens?: number, temperature?: number}} options
 * @returns {{url: string, headers: object, body: object}}
 */
function buildRequest(model, messages, options) {
  const key = $os.getenv(ENV_KEYS[model.provider] || '')
  if (!key) {
    throw {
      code: 'provider_unconfigured',
      status: 503,
      message: `provider "${model.provider}" needs the ${ENV_KEYS[model.provider]} instance env var`,
    }
  }
  const { system, turns } = splitSystem(messages)
  const maxTokens = options.maxTokens || 4096
  const temperature = options.temperature

  if (model.provider === 'anthropic') {
    const body = {
      model: model.id,
      max_tokens: maxTokens,
      messages: turns.map((m) => ({ role: m.role, content: m.content })),
    }
    if (system) body.system = system
    if (temperature !== undefined) body.temperature = temperature
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body,
    }
  }

  if (model.provider === 'openai') {
    const body = {
      model: model.id,
      input: turns.map((m) => ({ role: m.role, content: m.content })),
      max_output_tokens: maxTokens,
    }
    if (system) body.instructions = system
    if (temperature !== undefined) body.temperature = temperature
    return {
      url: 'https://api.openai.com/v1/responses',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body,
    }
  }

  if (model.provider === 'gemini') {
    const body = {
      contents: turns.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: maxTokens },
    }
    if (system) body.systemInstruction = { parts: [{ text: system }] }
    if (temperature !== undefined) body.generationConfig.temperature = temperature
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key,
      },
      body,
    }
  }

  throw { code: 'model_unknown', status: 400, message: `unsupported provider "${model.provider}"` }
}

/**
 * @param {{alias: string, provider: string, id: string}} model
 * @param {object} json provider response body
 * @returns {{text: string, usage: {input: number, output: number}, model: string, provider: string}}
 */
function parseResponse(model, json) {
  let text = ''
  let usage = { input: 0, output: 0 }

  if (model.provider === 'anthropic') {
    // content is an array of typed blocks; thinking blocks may precede text.
    text = (json.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
    usage = { input: json.usage?.input_tokens || 0, output: json.usage?.output_tokens || 0 }
  } else if (model.provider === 'openai') {
    // output can contain non-message items (reasoning, tool calls).
    for (const item of json.output || []) {
      if (item.type !== 'message') continue
      for (const block of item.content || []) {
        if (block.type === 'output_text') text += block.text
      }
    }
    usage = { input: json.usage?.input_tokens || 0, output: json.usage?.output_tokens || 0 }
  } else if (model.provider === 'gemini') {
    const candidate = (json.candidates || [])[0]
    text = ((candidate && candidate.content && candidate.content.parts) || [])
      .map((p) => p.text || '')
      .join('')
    usage = {
      input: json.usageMetadata?.promptTokenCount || 0,
      output: json.usageMetadata?.candidatesTokenCount || 0,
    }
  }

  return { text, usage, model: model.alias, provider: model.provider }
}

module.exports = { buildRequest, parseResponse, ENV_KEYS }
