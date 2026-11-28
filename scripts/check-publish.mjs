/**
 * Proves the packages are registry-ready without an npm credential. For every
 * public package this runs `npm publish --dry-run`, which applies npm's own
 * manifest validation — the step that rejects an unsupported protocol, a bad
 * name, or a missing `publishConfig` — and then checks that each path the
 * manifest advertises is actually inside the tarball npm would upload. Nothing
 * here contacts the registry, so it runs on every pull request.
 *
 * `--registry` is the other half of the proof: it asks npm directly whether each
 * package's manifest version resolves. Nothing is on the registry before the
 * first publish, so this mode runs after a publish rather than on a pull
 * request, and a partially published release fails it.
 *
 * Usage: pnpm publish:check [--registry]
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
// npm runs these from the tarball when a consumer installs it, so a published
// package must not carry them.
const LIFECYCLE = ['preinstall', 'install', 'postinstall']
// Entry points the registry metadata promises a consumer.
const FIELDS = ['main', 'module', 'types', 'browser']

/** Every `./path` string inside an `exports` value, at any nesting depth. */
function exportTargets(value, found = []) {
  if (typeof value === 'string') {
    if (value.startsWith('./')) found.push(value.slice(2))
  } else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) exportTargets(nested, found)
  }
  return found
}

/** The paths a manifest advertises, as they appear in a tarball. */
export function advertisedPaths(pkg) {
  const paths = new Set()
  for (const field of FIELDS) {
    const value = pkg[field]
    if (typeof value === 'string') paths.add(value.replace(/^\.\//, ''))
  }
  const bin = typeof pkg.bin === 'string' ? { [pkg.name]: pkg.bin } : (pkg.bin ?? {})
  for (const target of Object.values(bin)) {
    if (typeof target === 'string') paths.add(target.replace(/^\.\//, ''))
  }
  for (const target of exportTargets(pkg.exports)) paths.add(target)
  return [...paths]
}

/** Every package manifest under `<root>/packages`, keyed by its directory. */
export function readManifests(root) {
  const packageRoot = join(root, 'packages')
  const manifests = new Map()

  for (const entry of readdirSync(packageRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(packageRoot, entry.name)
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) continue
    manifests.set(dir, JSON.parse(readFileSync(manifest, 'utf8')))
  }

  return manifests
}

/**
 * Check every public package under `<root>/packages`.
 *
 * `publish` is injectable so tests can describe a dry run without running npm;
 * the default shells out to `npm publish --dry-run`.
 */
export function checkPublishReadiness(root, { publish = publishDryRun } = {}) {
  const problems = []
  const manifests = readManifests(root)

  const workspaceNames = new Set([...manifests.values()].map((pkg) => pkg.name))
  let packagesChecked = 0

  for (const [dir, pkg] of manifests) {
    if (pkg.private) continue
    packagesChecked += 1

    if (!pkg.name || !pkg.version) {
      problems.push(`${dir}: manifest has no name or version`)
      continue
    }
    if (!SEMVER.test(pkg.version)) {
      problems.push(`${pkg.name}: version "${pkg.version}" is not semver`)
      continue
    }
    if (pkg.version === '0.0.0') {
      problems.push(`${pkg.name}: version is still 0.0.0; version the packages before publishing`)
      continue
    }
    if (pkg.publishConfig?.access !== 'public') {
      problems.push(`${pkg.name}: publishConfig.access must be "public" for a scoped package`)
    }
    for (const script of LIFECYCLE) {
      if (pkg.scripts?.[script]) {
        problems.push(`${pkg.name}: scripts.${script} would run on a consumer's install`)
      }
    }
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const dependency of Object.keys(pkg[field] ?? {})) {
        if (dependency.startsWith('@swipeline/') && !workspaceNames.has(dependency)) {
          problems.push(`${pkg.name}: ${field} names ${dependency}, which is not a package here`)
        }
      }
    }

    const packed = publish(dir)
    if (packed.error) {
      problems.push(`${pkg.name}: npm publish --dry-run rejected the manifest: ${packed.error}`)
      continue
    }
    const expected = `${pkg.name}@${pkg.version}`
    if (packed.id !== expected) {
      problems.push(`${pkg.name}: dry run reported "${packed.id}", expected "${expected}"`)
    }
    const files = packed.files ?? new Set()
    const missing = advertisedPaths(pkg).filter((path) => !files.has(path))
    for (const path of missing) {
      problems.push(`${pkg.name}: "${path}" is advertised but not in the tarball`)
    }
  }

  return { packagesChecked, problems }
}

/** What npm would upload, or the reason it refused. */
export function publishDryRun(dir) {
  try {
    const raw = execFileSync(
      'npm',
      ['publish', '--dry-run', '--json', '--ignore-scripts', '--loglevel=error'],
      { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const parsed = JSON.parse(raw)
    // npm 10 prints an array; newer npm keys the object by package name.
    const info = Array.isArray(parsed) ? parsed[0] : parsed[Object.keys(parsed)[0]]
    return {
      id: info?.id,
      files: new Set((info?.files ?? []).map((file) => file.path)),
    }
  } catch (error) {
    const stderr = String(error?.stderr ?? '')
    const reason =
      stderr
        .split('\n')
        .map((line) => line.trim())
        .find((line) => /^npm (error|ERR!)/.test(line)) ?? error.message
    return { error: reason }
  }
}

/**
 * Ask the registry whether each public package resolves at its manifest version.
 *
 * `lookup` is injectable so tests never contact npm. It returns `'published'`,
 * `'missing'`, or `{ error }` for anything else the registry said.
 */
export function checkPublished(root, { lookup = registryLookup } = {}) {
  const problems = []
  const versions = new Set()
  let packagesChecked = 0

  for (const [dir, pkg] of readManifests(root)) {
    if (pkg.private) continue
    packagesChecked += 1

    if (!pkg.name || !pkg.version) {
      problems.push(`${dir}: manifest has no name or version`)
      continue
    }
    versions.add(pkg.version)

    const result = lookup(pkg.name, pkg.version)
    if (result === 'published') continue
    if (result === 'missing') {
      problems.push(`${pkg.name}@${pkg.version}: not on the registry`)
      continue
    }
    problems.push(`${pkg.name}@${pkg.version}: registry lookup failed (${result.error})`)
  }

  return { packagesChecked, versions: [...versions].sort(), problems }
}

/** What npm says about one package version: published, missing, or why it failed. */
export function registryLookup(name, version) {
  const spec = `${name}@${version}`
  try {
    const raw = execFileSync('npm', ['view', spec, 'version', '--json', '--loglevel=error'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const reported = JSON.parse(raw)
    if (reported === version) return 'published'
    return { error: `registry reports ${JSON.stringify(reported)}` }
  } catch (error) {
    const stderr = String(error?.stderr ?? '')
    // npm answers E404 for a version that does not exist, which is the expected
    // state before the first publish.
    if (/\bE404\b/.test(stderr)) return 'missing'
    const reason =
      stderr
        .split('\n')
        .map((line) => line.trim())
        .find((line) => /^npm (error|ERR!)/.test(line)) ?? error.message
    return { error: reason }
  }
}

function main() {
  const args = process.argv.slice(2)
  const unknown = args.filter((arg) => arg !== '--registry')
  if (unknown.length > 0) {
    console.error(`Unknown argument${unknown.length === 1 ? '' : 's'}: ${unknown.join(' ')}`)
    console.error('Usage: pnpm publish:check [--registry]')
    process.exit(2)
  }

  if (args.includes('--registry')) {
    const { packagesChecked, versions, problems } = checkPublished(process.cwd())

    if (problems.length > 0) {
      console.error('Not every package resolves on npm at its manifest version:\n')
      for (const problem of problems) console.error(`  ✗ ${problem}`)
      process.exit(1)
    }

    const at = versions.length === 1 ? versions[0] : versions.join(', ')
    console.log(
      `Registry check passed: all ${packagesChecked} package${packagesChecked === 1 ? '' : 's'} resolve on npm at ${at}.`,
    )
    return
  }

  const { packagesChecked, problems } = checkPublishReadiness(process.cwd())

  if (problems.length > 0) {
    console.error('Packages are not ready to publish:\n')
    for (const problem of problems) console.error(`  ✗ ${problem}`)
    process.exit(1)
  }

  console.log(
    `Publish dry run passed: ${packagesChecked} package${packagesChecked === 1 ? '' : 's'} accepted by npm publish --dry-run, every advertised entry point in the tarball.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
