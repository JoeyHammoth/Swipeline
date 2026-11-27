/**
 * Every published tarball must carry the Apache-2.0 LICENSE and the project
 * NOTICE (issue #52). A package copy may drift from the repository root, which
 * stays the single source of truth, so this checks three things per public
 * package: the two files exist, they match the root copies byte for byte, and
 * `npm pack --dry-run` actually lists them — the check a future change to
 * "files" cannot slip past.
 *
 * Usage: pnpm package:licenses
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const NAMES = ['LICENSE', 'NOTICE']

/**
 * Check every public package under `<root>/packages`.
 *
 * `pack` is injectable so tests can describe a tarball without running npm;
 * the default shells out to `npm pack --dry-run`.
 */
export function checkPackageLicenses(root, { pack = packFiles } = {}) {
  const source = Object.fromEntries(NAMES.map((name) => [name, readFileSync(join(root, name))]))

  const problems = []
  let packagesChecked = 0

  for (const entry of readdirSync(join(root, 'packages'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(root, 'packages', entry.name)
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) continue
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    if (pkg.private) continue
    packagesChecked += 1
    const listed = new Set(pkg.files ?? [])

    for (const name of Object.keys(source)) {
      const file = join(dir, name)
      if (!existsSync(file)) {
        problems.push(`${pkg.name}: ${name} is missing; run node scripts/sync-package-licenses.mjs`)
      } else if (!readFileSync(file).equals(source[name])) {
        problems.push(
          `${pkg.name}: ${name} differs from the root copy; run node scripts/sync-package-licenses.mjs`,
        )
      }
      if (!listed.has(name)) {
        problems.push(`${pkg.name}: ${name} is not listed in "files"`)
      }
    }

    const packed = pack(dir)
    if (packed === null) {
      problems.push(`${pkg.name}: npm pack --dry-run failed`)
      continue
    }
    for (const name of Object.keys(source)) {
      if (!packed.has(name)) problems.push(`${pkg.name}: npm pack does not include ${name}`)
    }
  }

  return { packagesChecked, problems }
}

/** Names npm would put in the tarball, or null when it could not run. */
export function packFiles(dir) {
  try {
    const raw = execFileSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts', '--loglevel=error'],
      {
        cwd: dir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const parsed = JSON.parse(raw)
    // npm 10 prints an array; newer npm keys the object by package name.
    const info = Array.isArray(parsed) ? parsed[0] : parsed[Object.keys(parsed)[0]]
    return new Set((info?.files ?? []).map((file) => file.path))
  } catch {
    return null
  }
}

function main() {
  const { packagesChecked, problems } = checkPackageLicenses(process.cwd())

  if (problems.length > 0) {
    console.error('Package license files are incomplete:\n')
    for (const problem of problems) console.error(`  ✗ ${problem}`)
    process.exit(1)
  }

  console.log(
    `Package license files passed: ${packagesChecked} package${packagesChecked === 1 ? '' : 's'} carry LICENSE and NOTICE.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
