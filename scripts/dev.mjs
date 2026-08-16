// Local development: downloads and caches the PocketBase binary in .pb/,
// ensures a local superuser, then runs the server plus a watch build of the
// foundation bundle.
//
//   npm run dev
//
// Server:    http://127.0.0.1:8090 (apps at /<name>/, admin UI at /_/)
// Superuser: local@cubby.test / cubby-local-dev (local only, never deployed)
import { spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// Track PocketHost's supported line (0.39.x as of 2026-08).
const PB_VERSION = process.env.PB_VERSION || '0.39.10'
const HTTP_ADDR = process.env.PB_HTTP || '127.0.0.1:8090'
const SUPERUSER_EMAIL = 'local@cubby.test'
const SUPERUSER_PASSWORD = 'cubby-local-dev'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const pbDir = path.join(root, '.pb')
const binary = path.join(pbDir, `pocketbase-${PB_VERSION}`)

async function ensureBinary() {
  if (existsSync(binary)) return
  mkdirSync(pbDir, { recursive: true })

  const os = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[process.platform]
  const arch = { arm64: 'arm64', x64: 'amd64' }[process.arch]
  if (!os || !arch) throw new Error(`unsupported platform ${process.platform}/${process.arch}`)

  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_${os}_${arch}.zip`
  console.log(`[dev] downloading ${url}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`)

  const zipPath = path.join(pbDir, 'pocketbase.zip')
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zipPath))

  const unzip = spawnSync('unzip', ['-o', zipPath, 'pocketbase', '-d', pbDir], { stdio: 'inherit' })
  if (unzip.status !== 0) throw new Error('unzip failed')
  spawnSync('mv', [path.join(pbDir, 'pocketbase'), binary])
  spawnSync('chmod', ['+x', binary])
  spawnSync('rm', [zipPath])
  console.log(`[dev] cached ${binary}`)
}

const serveArgs = [
  '--dir', path.join(pbDir, 'pb_data'),
  '--hooksDir', path.join(root, 'pb_hooks'),
  '--migrationsDir', path.join(root, 'pb_migrations'),
]

function ensureSuperuser() {
  // Superusers live in their own system collection; this never touches app data.
  const result = spawnSync(
    binary,
    ['superuser', 'upsert', SUPERUSER_EMAIL, SUPERUSER_PASSWORD, ...serveArgs],
    { stdio: 'inherit' }
  )
  if (result.status !== 0) console.warn('[dev] superuser upsert failed (continuing)')
}

async function main() {
  await ensureBinary()

  // Build once so pb_public always has a current bundle before the server starts.
  const build = spawnSync(process.execPath, [path.join(root, 'foundation', 'build.mjs')], {
    stdio: 'inherit',
  })
  if (build.status !== 0) process.exit(build.status)
  spawnSync(process.execPath, [path.join(root, 'scripts', 'build-manifest.mjs')], {
    stdio: 'inherit',
  })

  ensureSuperuser()

  const watcher = spawn(
    process.execPath,
    [path.join(root, 'foundation', 'build.mjs'), '--watch'],
    { stdio: 'inherit' }
  )

  const server = spawn(
    binary,
    ['serve', '--http', HTTP_ADDR, '--publicDir', path.join(root, 'pb_public'), ...serveArgs],
    { stdio: 'inherit' }
  )

  const stop = () => {
    watcher.kill()
    server.kill()
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  server.on('exit', (code) => {
    watcher.kill()
    process.exit(code ?? 0)
  })

  console.log(`[dev] http://${HTTP_ADDR}/ (admin: http://${HTTP_ADDR}/_/ as ${SUPERUSER_EMAIL})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
