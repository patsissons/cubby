// Provider request builder and response parser for the AI proxy.
// Every model routes through OpenRouter's OpenAI-compatible chat completions
// endpoint, called non-streaming via $http.send and normalized to
// { text, usage: {input, output, reasoning}, citations, model, provider }.
// One key, one surface: the registry in cubby.config.json picks the upstream
// model by id. Messages and options arrive already validated by lib/ai.js.

const ENV_KEYS = {
  openrouter: 'OPENROUTER_API_KEY',
}

/**
 * @param {{alias: string, provider: string, id: string}} model
 * @param {Array<{role: string, content: string | Array<{type: string, text?: string, image_url?: {url: string}}>}>} messages
 * @param {{maxTokens?: number, temperature?: number, reasoning?: string, webSearch?: {maxResults: number}}} options
 * @returns {{url: string, headers: object, body: object}}
 */
function buildRequest(model, messages, options) {
  if (model.provider !== 'openrouter') {
    throw { code: 'model_unknown', status: 400, message: `unsupported provider "${model.provider}"` }
  }
  const key = $os.getenv(ENV_KEYS.openrouter)
  if (!key) {
    throw {
      code: 'provider_unconfigured',
      status: 503,
      message: `provider "${model.provider}" needs the ${ENV_KEYS.openrouter} instance env var`,
    }
  }

  const body = {
    model: model.id,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: options.maxTokens || 4096,
    stream: false,
  }
  if (options.temperature !== undefined) body.temperature = options.temperature
  // Reasoning tokens bill as output and count against max_tokens; exclude
  // keeps the trace out of the response, since apps only read the answer.
  if (options.reasoning) body.reasoning = { effort: options.reasoning, exclude: true }
  if (options.webSearch) body.plugins = [{ id: 'web', max_results: options.webSearch.maxResults }]

  // Attribution headers are optional; OpenRouter shows them on its dashboard.
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  }
  try {
    const { loadCubbyConfig } = require(`${__hooks}/lib/config.js`)
    const config = loadCubbyConfig()
    if (config.domain) headers['HTTP-Referer'] = String(config.domain)
    if (config.title) headers['X-Title'] = String(config.title)
  } catch (err) {
    // config is optional for attribution only
  }

  return { url: 'https://openrouter.ai/api/v1/chat/completions', headers, body }
}

/**
 * @param {{alias: string, provider: string, id: string}} model
 * @param {object} json provider response body
 * @returns {{text: string, usage: {input: number, output: number, reasoning: number}, citations: Array<{url: string, title: string}>, model: string, provider: string}}
 */
function parseResponse(model, json) {
  // OpenRouter can answer 200 with an error object when the upstream fails.
  if (json && json.error) {
    throw {
      code: 'provider_error',
      status: 502,
      message: `openrouter: ${json.error.message || json.error.code || 'upstream error'}`,
    }
  }
  const choice = (json.choices || [])[0]
  const content = choice && choice.message ? choice.message.content : ''
  // content is normally a string; some models return an array of parts.
  const text = Array.isArray(content) ? content.map((p) => (p && p.text) || '').join('') : content || ''
  const usage = {
    input: json.usage?.prompt_tokens || 0,
    output: json.usage?.completion_tokens || 0,
    reasoning: json.usage?.completion_tokens_details?.reasoning_tokens || 0,
  }
  // Web search results come back as url_citation annotations on the message.
  const citations = []
  const annotations =
    choice && choice.message && Array.isArray(choice.message.annotations) ? choice.message.annotations : []
  for (const note of annotations) {
    const cite = note && note.type === 'url_citation' ? note.url_citation : null
    if (!cite || typeof cite.url !== 'string' || citations.some((c) => c.url === cite.url)) continue
    citations.push({ url: cite.url, title: typeof cite.title === 'string' ? cite.title : '' })
  }
  return { text, usage, citations, model: model.alias, provider: model.provider }
}

module.exports = { buildRequest, parseResponse, ENV_KEYS }
