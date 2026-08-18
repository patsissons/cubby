// Markdown renderer tests. Pure Node, no server: imports render() from the
// built ESM bundle (the shipped artifact, mirroring the smoke philosophy).
//
//   npm run build          # artifact must exist / be fresh
//   node scripts/markdown-tests.mjs
import assert from 'node:assert/strict'

const { render } = await import('../pb_public/js/markdown.esm.js')

let passed = 0
async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`ok   ${name}`)
  } catch (err) {
    console.error(`FAIL ${name}`)
    console.error(err)
    process.exitCode = 1
  }
}

const has = (src, ...parts) => {
  const html = render(src)
  for (const part of parts) {
    assert.ok(html.includes(part), `expected ${JSON.stringify(part)} in:\n${html}`)
  }
  return html
}
const lacks = (src, ...parts) => {
  const html = render(src)
  for (const part of parts) {
    assert.ok(!html.includes(part), `expected NO ${JSON.stringify(part)} in:\n${html}`)
  }
  return html
}

// --- blocks ---

await test('headings h1-h6, trailing hashes stripped', () => {
  has('# One', '<h1>One</h1>')
  has('###### Six', '<h6>Six</h6>')
  has('## Two ##', '<h2>Two</h2>')
  has('####### seven', '<p>####### seven</p>')
})

await test('paragraphs merge lines; blank lines split', () => {
  const html = has('a\nb\n\nc', '<p>a\nb</p>', '<p>c</p>')
  assert.equal((html.match(/<p>/g) || []).length, 2)
})

await test('hard breaks: two spaces and backslash', () => {
  has('a  \nb', '<br>')
  has('a\\\nb', '<br>')
  lacks('a\nb', '<br>')
})

await test('hr variants', () => {
  has('---', '<hr>')
  has('* * *', '<hr>')
  has('___', '<hr>')
  lacks('--', '<hr>')
})

await test('fenced code: escaped, language class, unclosed runs to EOF', () => {
  has('```js\nconst a = 1 < 2\n```', '<pre><code class="language-js">const a = 1 &lt; 2\n</code></pre>')
  has('~~~\n*not em*\n~~~', '<pre><code>*not em*\n</code></pre>')
  has('```\nno closing fence', 'no closing fence')
  lacks('```\n# not a heading\n```', '<h1>')
})

await test('blockquotes, including nested', () => {
  has('> quoted', '<blockquote>\n<p>quoted</p>\n</blockquote>')
  has('> outer\n> > inner', '<blockquote>\n<p>outer</p>\n<blockquote>\n<p>inner</p>\n</blockquote>\n</blockquote>')
})

await test('unordered and ordered lists, nesting, start attr', () => {
  has('- a\n- b', '<ul>\n<li>a</li>\n<li>b</li>\n</ul>')
  has('1. a\n2. b', '<ol>\n<li>a</li>\n<li>b</li>\n</ol>')
  has('3. a\n4. b', '<ol start="3">')
  has('- a\n  - a1\n- b', '<li>a<ul>\n<li>a1</li>\n</ul>\n</li>')
  has('1. a\n   - a1', '<ol>\n<li>a<ul>')
})

await test('task lists', () => {
  has('- [ ] todo', '<li class="task"><input type="checkbox" disabled> todo</li>')
  has('- [x] done', '<input type="checkbox" disabled checked> done')
  has('- [X] DONE', 'checked')
})

await test('tables: alignment enum, escaped pipes, ragged rows', () => {
  const html = has(
    '| a | b | c |\n| :- | :-: | -: |\n| 1 | 2 | 3 |\n| x | y |',
    '<table>',
    '<th style="text-align:left">a</th>',
    '<th style="text-align:center">b</th>',
    '<th style="text-align:right">c</th>',
    '<td style="text-align:left">1</td>',
    '<td style="text-align:right"></td>'
  )
  assert.ok(html.includes('<tbody>'))
  has('| a\\|b |\n| --- |\n| c |', 'a|b')
  // no delimiter row -> not a table
  lacks('| a | b |\njust text', '<table>')
})

// --- inline ---

await test('emphasis: em, strong, nested, strikethrough', () => {
  has('*em*', '<p><em>em</em></p>')
  has('**strong**', '<strong>strong</strong>')
  has('***both***', '<em><strong>both</strong></em>')
  has('~~gone~~', '<del>gone</del>')
  has('**bold *nested* bold**', '<strong>bold <em>nested</em> bold</strong>')
})

await test('snake_case and mid-word underscores survive', () => {
  has('a snake_case_name here', 'snake_case_name')
  lacks('a snake_case_name here', '<em>')
})

await test('code spans: literal content, backtick runs', () => {
  has('`a *b* <c>`', '<code>a *b* &lt;c&gt;</code>')
  has('`` a`b ``', '<code>a`b</code>')
  has('`unclosed', '`unclosed')
})

await test('links: title, escapes, no nested links', () => {
  has('[text](https://example.com)', '<a href="https://example.com">text</a>')
  has('[t](https://e.com "ti")', ' title="ti"')
  has('[*em* text](https://e.com)', '<a href="https://e.com"><em>em</em> text</a>')
  const html = render('[a [b](https://x.com) c](https://y.com)')
  assert.ok(!/<a[^>]*>[^<]*<a/.test(html), `nested <a> in:\n${html}`)
})

await test('images: alt flattened, title', () => {
  has('![alt *text*](https://e.com/i.png)', '<img src="https://e.com/i.png" alt="alt text">')
  has('![a](https://e.com/i.png "t")', ' title="t"')
})

await test('autolinks: angle and bare, trailing punctuation trimmed', () => {
  has('<https://example.com>', '<a href="https://example.com">https://example.com</a>')
  has('<mailto:a@b.com>', '<a href="mailto:a@b.com">a@b.com</a>')
  has('see https://example.com/x.', '<a href="https://example.com/x">')
  has('(see https://example.com/y)', '<a href="https://example.com/y">')
  has('https://en.wikipedia.org/wiki/A_(b)', 'wiki/A_(b)')
})

await test('backslash escapes', () => {
  has('\\*not em\\*', '*not em*')
  lacks('\\*not em\\*', '<em>')
  has('\\# not heading', '<p># not heading</p>')
})

await test('render opts: linkTarget adds rel', () => {
  const html = render('[a](https://e.com)', { linkTarget: '_blank' })
  assert.ok(html.includes('target="_blank" rel="noopener noreferrer"'), html)
})

// --- security battery ---

await test('raw html is always escaped', () => {
  has('<script>alert(1)</script>', '&lt;script&gt;alert(1)&lt;/script&gt;')
  lacks('<script>alert(1)</script>', '<script>')
  lacks('<img src=x onerror=alert(1)>', '<img')
  has('# <b>h</b>', '<h1>&lt;b&gt;h&lt;/b&gt;</h1>')
  lacks('| <i>x</i> |\n| --- |\n| <u>y</u> |', '<i>', '<u>')
})

await test('dangerous url schemes are stripped', () => {
  has('[x](javascript:alert(1))', 'href=""')
  has('[x](JAVASCRIPT:alert(1))', 'href=""')
  // A literal tab/newline ends the destination scan, so these fail to
  // parse as links at all (also safe). The <dest> form does accept them
  // and must hit the sanitizer's control-char stripping.
  lacks('[x](java\tscript:alert(1))', '<a')
  lacks('[x](java\nscript:alert(1))', '<a')
  has('[x](<java\tscript:alert(1)>)', 'href=""')
  has('[x](data:text/html,<script>alert(1)</script>)', 'href=""')
  has('[x](vbscript:x)', 'href=""')
  has('![x](javascript:alert(1))', 'src=""')
  has('![x](data:image/svg+xml,foo)', 'src=""')
})

await test('mailto allowed in links, blocked in images; relative allowed', () => {
  has('[m](mailto:a@b.com)', 'href="mailto:a@b.com"')
  has('![m](mailto:a@b.com)', 'src=""')
  has('[r](/docs/#anchor)', 'href="/docs/#anchor"')
  has('![r](uploads/i.png)', 'src="uploads/i.png"')
})

await test('attribute contexts escape quotes and brackets', () => {
  has('[x](https://e.com \'"><img src=x onerror=alert(1)>\')', '&quot;&gt;&lt;img')
  lacks('[x](https://e.com \'"><img src=x onerror=alert(1)>\')', '"><img')
  has('![">alt](https://e.com/i.png)', 'alt="&quot;&gt;alt"')
  const html = render('```"><script>\ncode\n```')
  assert.ok(!html.includes('"><script>'), html)
})

await test('href attribute cannot be broken out of', () => {
  const html = render('[x](https://e.com/"onmouseover="alert(1))')
  assert.ok(!html.includes('" onmouseover'), html)
  assert.ok(html.includes('&quot;onmouseover'), html)
})

// --- pathological input terminates quickly ---

await test('pathological input terminates', () => {
  const start = Date.now()
  render('*'.repeat(10000))
  render('['.repeat(5000))
  render('> '.repeat(2000) + 'deep')
  render('```\n' + 'x\n'.repeat(5000))
  render('a_'.repeat(5000))
  const ms = Date.now() - start
  assert.ok(ms < 5000, `took ${ms}ms`)
})

await test('non-string and empty input', () => {
  assert.equal(render(''), '')
  assert.equal(render('   \n  '), '')
  assert.equal(render(null), '')
  assert.equal(render(undefined), '')
})

console.log(process.exitCode ? 'FAILED' : `all ${passed} tests passed`)
