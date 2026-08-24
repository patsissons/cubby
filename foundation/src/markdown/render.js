import { escapeHtml } from '#core'
import { renderInline } from './inline.js'

/**
 * Block-level markdown: a line cursor emitting blocks, delegating block
 * contents to the inline pass. Supported: ATX headings, fenced code,
 * hr, blockquotes (nested), lists (nested, ordered start, task items),
 * tables (GFM pipe style), paragraphs with hard breaks. Documented
 * out-of-scope subset cuts: setext headings, reference-style links,
 * indented code blocks, multi-line (lazy) list items and blockquotes.
 */

const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/
const HR = /^ {0,3}(?:(?:- *){3,}|(?:\* *){3,}|(?:_ *){3,})$/
const QUOTE = /^ {0,3}>/
const ITEM = /^( *)([-*+]|\d{1,9}[.)])[ \t]+(.*)$/
const TASK = /^\[( |x|X)\][ \t]+/

/** @returns {{indent: number, marker: string, content: string, ordered: boolean} | null} */
function matchListItem(line) {
  const m = ITEM.exec(line)
  if (!m) return null
  return { indent: m[1].length, marker: m[2], content: m[3], ordered: WORD_DIGIT.test(m[2][0]) }
}

const WORD_DIGIT = /[0-9]/

/** Split a table row on unescaped pipes, dropping boundary pipe cells. */
function splitRow(line) {
  const trimmed = line.trim()
  const cells = []
  let cur = ''
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i]
    if (c === '\\' && trimmed[i + 1] === '|') {
      cur += '|'
      i++
      continue
    }
    if (c === '\\' && trimmed[i + 1]) {
      cur += c + trimmed[i + 1]
      i++
      continue
    }
    if (c === '|') {
      cells.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  cells.push(cur)
  if (cells.length && trimmed.startsWith('|') && cells[0].trim() === '') cells.shift()
  if (cells.length && trimmed.endsWith('|') && cells[cells.length - 1].trim() === '') cells.pop()
  return cells
}

function isDelimiterRow(line) {
  if (!line || !line.includes('-')) return false
  const cells = splitRow(line)
  return cells.length > 0 && cells.every((c) => /^ *:?-+:? *$/.test(c))
}

/** Alignment is a fixed enum — user text never reaches a style attribute. */
function alignAttr(align) {
  return align ? ` style="text-align:${align}"` : ''
}

/** @returns {{html: string, end: number} | null} table starting at lines[i], or null */
function parseTable(lines, i, opts) {
  const line = lines[i]
  if (!line.includes('|') || !isDelimiterRow(lines[i + 1])) return null
  const header = splitRow(line)
  const aligns = splitRow(lines[i + 1]).map((c) => {
    const s = c.trim()
    const left = s.startsWith(':')
    const right = s.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    if (left) return 'left'
    return ''
  })
  if (!header.length || header.length !== aligns.length) return null
  let html = '<table>\n<thead>\n<tr>\n'
  header.forEach((cell, k) => {
    html += `<th${alignAttr(aligns[k])}>${renderInline(cell.trim(), opts)}</th>\n`
  })
  html += '</tr>\n</thead>\n'
  let j = i + 2
  const rows = []
  while (j < lines.length && lines[j].trim() && lines[j].includes('|')) {
    rows.push(splitRow(lines[j]))
    j++
  }
  if (rows.length) {
    html += '<tbody>\n'
    for (const row of rows) {
      html += '<tr>\n'
      for (let k = 0; k < header.length; k++) {
        html += `<td${alignAttr(aligns[k])}>${renderInline((row[k] || '').trim(), opts)}</td>\n`
      }
      html += '</tr>\n'
    }
    html += '</tbody>\n'
  }
  html += '</table>\n'
  return { html, end: j }
}

/** @returns {{html: string, end: number}} list starting at lines[start] */
function parseList(lines, start, opts) {
  const first = matchListItem(lines[start])
  const baseIndent = first.indent
  const ordered = first.ordered
  const startNum = ordered ? parseInt(first.marker, 10) : 1
  const items = []
  let i = start
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) break
    const item = matchListItem(line)
    if (!item || item.indent < baseIndent) break
    if (item.indent >= baseIndent + 2) {
      // deeper indent: a nested list inside the previous item
      const nested = parseList(lines, i, opts)
      items[items.length - 1].nested += nested.html
      i = nested.end
      continue
    }
    items.push({ content: item.content, nested: '' })
    i++
  }
  let html = ordered ? (startNum !== 1 ? `<ol start="${startNum}">\n` : '<ol>\n') : '<ul>\n'
  for (const it of items) {
    const task = TASK.exec(it.content)
    if (task) {
      const checked = task[1].toLowerCase() === 'x' ? ' checked' : ''
      const rest = it.content.slice(task[0].length)
      html += `<li class="task"><input type="checkbox" disabled${checked}> ${renderInline(rest, opts)}${it.nested}</li>\n`
    } else {
      html += `<li>${renderInline(it.content, opts)}${it.nested}</li>\n`
    }
  }
  html += ordered ? '</ol>\n' : '</ul>\n'
  return { html, end: i }
}

/** Would this line start a non-paragraph block? (ends paragraph accumulation) */
function isBlockStart(line, next) {
  return (
    FENCE.test(line) ||
    HEADING.test(line) ||
    HR.test(line) ||
    QUOTE.test(line) ||
    ITEM.test(line) ||
    (line.includes('|') && isDelimiterRow(next))
  )
}

/** @param {string[]} lines @param {{linkTarget?: string}} opts @returns {string} */
function renderBlocks(lines, opts) {
  let out = ''
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    const fence = FENCE.exec(line)
    if (fence) {
      const marker = fence[1]
      const info = fence[2]
      const body = []
      let j = i + 1
      while (j < lines.length) {
        const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(lines[j])
        if (close && close[1][0] === marker[0] && close[1].length >= marker.length) break
        body.push(lines[j])
        j++
      }
      const lang = info ? ` class="language-${escapeHtml(info)}"` : ''
      const code = body.length ? escapeHtml(body.join('\n')) + '\n' : ''
      out += `<pre><code${lang}>${code}</code></pre>\n`
      i = j + 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const level = heading[1].length
      const content = (heading[2] || '').replace(/[ \t]+#+[ \t]*$/, '')
      out += `<h${level}>${renderInline(content, opts)}</h${level}>\n`
      i++
      continue
    }

    if (HR.test(line)) {
      out += '<hr>\n'
      i++
      continue
    }

    if (QUOTE.test(line)) {
      const quoted = []
      while (i < lines.length && QUOTE.test(lines[i])) {
        quoted.push(lines[i].replace(/^ {0,3}> ?/, ''))
        i++
      }
      out += `<blockquote>\n${renderBlocks(quoted, opts)}</blockquote>\n`
      continue
    }

    const table = parseTable(lines, i, opts)
    if (table) {
      out += table.html
      i = table.end
      continue
    }

    if (matchListItem(line)) {
      const list = parseList(lines, i, opts)
      out += list.html
      i = list.end
      continue
    }

    const para = [line]
    let j = i + 1
    while (j < lines.length && lines[j].trim() && !isBlockStart(lines[j], lines[j + 1])) {
      para.push(lines[j])
      j++
    }
    out += `<p>${renderInline(para.join('\n'), opts)}</p>\n`
    i = j
  }
  return out
}

/**
 * Render markdown to an HTML string. The output is safe by construction —
 * every source character is escaped at emission and URLs are vetted — so
 * it is the one sanctioned innerHTML source. Never concatenate raw user
 * data around the returned string.
 * @param {string} src markdown source
 * @param {{linkTarget?: string}} [opts] linkTarget: '_blank' also adds rel="noopener noreferrer"
 * @returns {string}
 */
export function render(src, opts = {}) {
  if (typeof src !== 'string' || !src.trim()) return ''
  return renderBlocks(src.replace(/\r\n?/g, '\n').split('\n'), opts)
}
