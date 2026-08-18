// Builds the foundation bundle: pb_public/js/foundation.js (IIFE, window.cubby)
// and pb_public/js/foundation.esm.js (ES module), plus the opt-in markdown
// bundle: pb_public/js/markdown.js / markdown.esm.js. All are committed
// artifacts; CI fails if they drift from a fresh build. Pass --watch for
// rebuild-on-change.
import { build, context } from 'esbuild'
import { gzipSync } from 'node:zlib'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const watch = process.argv.includes('--watch')

/** @type {import('esbuild').BuildOptions} */
const shared = {
  bundle: true,
  minify: true,
  target: 'es2020',
  sourcemap: false,
  logLevel: 'info',
  define: { __CUBBY_VERSION__: JSON.stringify(pkg.version) },
  banner: { js: `/* cubby foundation v${pkg.version} (${pkg.repository}) */` },
}

// maxGzip is a per-bundle budget; checkSize() fails the build on breach.
const builds = [
  {
    ...shared,
    entryPoints: [path.join(root, 'foundation/src/global.js')],
    outfile: path.join(root, 'pb_public/js/foundation.js'),
    format: 'iife',
    maxGzip: 50 * 1024,
  },
  {
    ...shared,
    entryPoints: [path.join(root, 'foundation/src/index.js')],
    outfile: path.join(root, 'pb_public/js/foundation.esm.js'),
    format: 'esm',
    maxGzip: 50 * 1024,
  },
  {
    ...shared,
    entryPoints: [path.join(root, 'foundation/src/markdown/global.js')],
    outfile: path.join(root, 'pb_public/js/markdown.js'),
    format: 'iife',
    maxGzip: 20 * 1024,
    banner: { js: `/* cubby markdown v${pkg.version} (${pkg.repository}) */` },
  },
  {
    ...shared,
    entryPoints: [path.join(root, 'foundation/src/markdown/index.js')],
    outfile: path.join(root, 'pb_public/js/markdown.esm.js'),
    format: 'esm',
    maxGzip: 20 * 1024,
    banner: { js: `/* cubby markdown v${pkg.version} (${pkg.repository}) */` },
  },
]

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

if (watch) {
  const contexts = await Promise.all(builds.map((b) => context(esbuildOptions(b))))
  await Promise.all(contexts.map((c) => c.watch()))
  console.log('[foundation] watching for changes...')
} else {
  await Promise.all(builds.map((b) => build(esbuildOptions(b))))
  checkSize()
}
