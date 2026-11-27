/**
 * Dependency license policy (design plan 4.3 and 10.2).
 *
 * Only permissive licenses are allowed in production dependency trees. Copyleft
 * and source-available licenses are blocked, including the "free for
 * evaluation, commercial license required for production" variants that some
 * SQLite extensions use.
 *
 * Scoped to publishable workspace packages: the private example apps are not
 * distributed, and their native toolchain (Expo/Metro) carries MPL and
 * dual-licensed packages that never reach a tarball.
 *
 * Usage: pnpm licenses:check
 */
import { execFileSync } from 'node:child_process'

const ALLOWED = new Set([
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'Unlicense',
  'WTFPL',
])

const BLOCKED_HINTS = ['GPL', 'AGPL', 'SSPL', 'BUSL', 'Commons Clause', 'UNLICENSED', 'SEE LICENSE']

let raw
try {
  // Recursive so workspace packages' production dependencies are included.
  raw = execFileSync(
    'pnpm',
    ['-r', '--filter', './packages/**', 'licenses', 'list', '--prod', '--json'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
} catch (error) {
  console.error('Could not read the production dependency tree. Run `pnpm install` first.')
  console.error(String(error.stderr ?? error).slice(0, 500))
  process.exit(1)
}

const report = raw.trim() === '' ? {} : JSON.parse(raw)

const violations = []
let count = 0

for (const [license, entries] of Object.entries(report)) {
  const packages = Array.isArray(entries) ? entries : (entries?.packages ?? [])
  count += packages.length
  if (ALLOWED.has(license)) continue
  const blocked = BLOCKED_HINTS.some((hint) => license.toUpperCase().includes(hint.toUpperCase()))
  violations.push({ license, blocked, packages })
}

if (violations.length > 0) {
  console.error('Disallowed dependency licenses:\n')
  for (const violation of violations) {
    const kind = violation.blocked ? 'BLOCKED' : 'needs review'
    console.error(`  ✗ ${violation.license} (${kind})`)
    for (const pkg of violation.packages) {
      const versions = pkg.versions ? pkg.versions.join(', ') : (pkg.version ?? '?')
      console.error(`      ${pkg.name}@${versions}`)
    }
  }
  console.error(
    '\nIf one of these is a build-only or dev-only dependency, move it to devDependencies.',
  )
  process.exit(1)
}

console.log(
  `License policy passed: ${count} production dependenc${count === 1 ? 'y' : 'ies'} in published packages.`,
)
