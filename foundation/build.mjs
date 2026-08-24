// Builds the cubby bundles into pb_public/js/, plus the design-token
// stylesheet into pb_public/css/. Every output is a committed artifact and CI
// fails if any drifts from a fresh build. Pass --watch for rebuild-on-change.
//
// Layering:
//   core.js       the namespace, CubbyError, escaping, widget lifecycle, tokens
//   platform.js   PocketBase: config/identity/db/fs/ai/rooms  (needs core)
//   markdown.js   render()                                    (needs core)
//   editor.js     textarea + preview + paste upload           (needs markdown)
//   nav.js        sticky two-row site bar                     (needs core)
//   foundation.js DEPRECATED all-in-one core+platform, kept for cached pages
//
// NOTE: `npm run dev` holds esbuild watch contexts built from THIS file as it
// was when the server started. After editing the builds array or a resolver,
// restart the dev server -- a stale watcher writes stale artifacts over a fresh
// `npm run build`, and the only thing that catches it is the CI drift gate.
//
// An ESM twin ships only where a Node test or the smoke suite imports it.
// Widgets that are pure DOM get an IIFE build alone until a pure function in
// them earns a test.
import { build, context } from 'esbuild'
import { gzipSync } from 'node:zlib'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { TOKENS_CSS } from './src/core/tokens.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const watch = process.argv.includes('--watch')

const out = (file) => path.join(root, 'pb_public/js', file)
const src = (dir, file) => path.join(root, 'foundation/src', dir, file)

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  minify: true,
  target: 'es2020',
  sourcemap: false,
  logLevel: 'info',
  define: { __CUBBY_VERSION__: JSON.stringify(pkg.version) },
}

const CORE_SRC = src('core', 'index.js')
const CORE_WINDOW = src('shared', 'core-global.js')
// Written verbatim into ESM output; resolves as a sibling of the importer both
// for Node (file://) and for a browser <script type="module">.
const CORE_EXTERNAL = './core.esm.js'

/**
 * Resolve the virtual '#core' specifier. This one plugin is what makes
 * `err instanceof cubby.CubbyError` hold across bundles: exactly one build
 * contains the class definition, and everything else either imports it (ESM)
 * or reads it back off window.cubby (IIFE).
 *
 * 'external' is deliberately NOT used for IIFE output -- esbuild lowers an
 * external import there into a __require() shim that throws in a browser.
 *
 * @param {'inline'|'external'|'window'} mode
 */
const coreResolver = (mode) => ({
  name: 'cubby-core',
  setup(build) {
    build.onResolve({ filter: /^#core$/ }, () =>
      mode === 'external'
        ? { path: CORE_EXTERNAL, external: true }
        : { path: mode === 'window' ? CORE_WINDOW : CORE_SRC }
    )
  },
})

// name, source dir, gzip budget (KB), the ESM entry file (falsy = no ESM twin),
// and whether this bundle is core itself (and so inlines rather than borrows).
// platform's ESM entry is esm.js, not index.js: it builds its namespace with a
// top-level call, and index.js is shared with the IIFE build.
const MODULES = [
  { name: 'core', dir: 'core', gz: 4, esm: 'index.js', self: true },
  { name: 'platform', dir: 'platform', gz: 16, esm: 'esm.js' },
  { name: 'markdown', dir: 'markdown', gz: 8, esm: 'index.js' },
  { name: 'editor', dir: 'editor', gz: 4 },
  { name: 'nav', dir: 'nav', gz: 4 },
]

const banner = (name) => ({ js: `/* cubby ${name} v${pkg.version} (${pkg.repository}) */` })

const builds = [
  ...MODULES.flatMap(({ name, dir, gz, esm, self }) => [
    {
      ...shared,
      banner: banner(name),
      entryPoints: [src(dir, 'global.js')],
      outfile: out(`${name}.js`),
      format: 'iife',
      plugins: [coreResolver(self ? 'inline' : 'window')],
      maxGzip: gz * 1024,
    },
    ...(esm
      ? [
          {
            ...shared,
            banner: banner(name),
            entryPoints: [src(dir, esm)],
            outfile: out(`${name}.esm.js`),
            format: 'esm',
            plugins: [coreResolver(self ? 'inline' : 'external')],
            maxGzip: gz * 1024,
          },
        ]
      : []),
  ]),

  // DEPRECATED all-in-one. The IIFE build must stay standalone: a page cached
  // before the migration has no core.js tag beside it, so this one inlines
  // core. The ESM twin can share the canonical class -- both files ship side by
  // side -- so it does, keeping instanceof consistent for Node consumers.
  {
    ...shared,
    banner: banner('foundation (deprecated: load core.js + platform.js instead)'),
    entryPoints: [src('compat', 'global.js')],
    outfile: out('foundation.js'),
    format: 'iife',
    plugins: [coreResolver('inline')],
    maxGzip: 18 * 1024,
  },
  {
    ...shared,
    banner: banner('foundation (deprecated: import core.esm.js + platform.esm.js instead)'),
    entryPoints: [src('compat', 'index.js')],
    outfile: out('foundation.esm.js'),
    format: 'esm',
    plugins: [coreResolver('external')],
    maxGzip: 18 * 1024,
  },
]

/**
 * Emit the static token sheet from the same string core.js embeds. Two
 * hand-maintained copies would drift, and the drift gate covers this one
 * because it is a committed artifact like any bundle.
 */
function writeTokens() {
  const file = path.join(root, 'pb_public/css/tokens.css')
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(
    file,
    `/* cubby tokens v${pkg.version} -- generated by foundation/build.mjs, do not edit.\n` +
      `   Source: foundation/src/core/tokens.js. Link this BEFORE an app's own\n` +
      `   stylesheet, carrying data-cubby-tokens so core.js knows not to inject. */\n` +
      TOKENS_CSS
  )
  console.log(`pb_public/css/tokens.css: ${TOKENS_CSS.length} bytes`)
}

function checkSize() {
  for (const { maxGzip, ...b } of builds) {
    const raw = readFileSync(b.outfile)
    const gzipped = gzipSync(raw).length
    const label = path.relative(root, b.outfile)
    console.log(`${label}: ${raw.length} bytes (${(gzipped / 1024).toFixed(1)}KB gzipped)`)
    if (gzipped > maxGzip) {
      console.error(`${label} exceeds the ${maxGzip / 1024}KB gzipped budget`)
      process.exitCode = 1
    }
  }
}

// esbuild rejects unknown options, so strip the budget field before passing through
const esbuildOptions = ({ maxGzip, ...b }) => b

writeTokens()

if (watch) {
  const contexts = await Promise.all(builds.map((b) => context(esbuildOptions(b))))
  await Promise.all(contexts.map((c) => c.watch()))
  console.log('[foundation] watching for changes...')
} else {
  await Promise.all(builds.map((b) => build(esbuildOptions(b))))
  checkSize()
}
