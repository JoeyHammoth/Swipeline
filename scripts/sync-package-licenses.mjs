/**
 * Copy the repository-root LICENSE and NOTICE into every public package.
 *
 * npm packs a tarball from the package directory, so a repository-root LICENSE
 * is not included. The root files stay the single source of truth; this script
 * stages the copies and `scripts/check-package-licenses.mjs` fails CI when a
 * copy drifts or a package forgets to list it in "files".
 *
 * Usage: node scripts/sync-package-licenses.mjs
 */
import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const packages = join(root, 'packages')
let copied = 0

for (const entry of readdirSync(packages, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const dir = join(packages, entry.name)
  const manifest = join(dir, 'package.json')
  if (!existsSync(manifest)) continue
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
  if (pkg.private) continue
  for (const name of ['LICENSE', 'NOTICE']) {
    copyFileSync(join(root, name), join(dir, name))
    copied += 1
  }
}

console.log(`Copied LICENSE and NOTICE into ${copied / 2} package${copied === 2 ? '' : 's'}.`)
