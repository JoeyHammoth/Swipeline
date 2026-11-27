/**
 * Enforces the framework-agnostic rule from the design plan (5.8.1, Rule 5):
 * only binding packages may depend on or import a UI framework.
 *
 * Two checks, because either one alone is easy to slip past:
 *   1. package.json dependencies / peerDependencies, for non-binding packages
 *   2. a source scan for framework imports, since a package could import a
 *      transitive dependency without declaring it
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const BINDING_PACKAGES = new Set(['react', 'react-native', 'vue', 'svelte', 'element'])
/**
 * Scaffolders emit framework projects as strings rather than importing a
 * framework. The source scan matches import syntax in text, so their templates
 * would trip a rule that does not apply to them; their declared dependencies are
 * still checked, and they must not depend on a framework themselves.
 */
const SCAFFOLD_PACKAGES = new Set(['create-swipeline'])
const FORBIDDEN = [
  'react',
  'react-dom',
  'react-native',
  'vue',
  'svelte',
  '@angular/core',
  'solid-js',
  'preact',
]
const IMPORT_PATTERN = new RegExp(
  String.raw`(?:from\s*|import\s*\(\s*|require\s*\(\s*)['"](${FORBIDDEN.map((f) => f.replace('/', '\\/')).join('|')})(?:\/[^'"]*)?['"]`,
)

const failures = []

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue
      walk(path, files)
    } else if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry)) {
      files.push(path)
    }
  }
  return files
}

const packagesDir = join(ROOT, 'packages')
const packageDirs = readdirSync(packagesDir).filter((name) => {
  if (!statSync(join(packagesDir, name)).isDirectory()) return false
  // Only real workspace packages count; docs/markdown folders are skipped.
  return existsSync(join(packagesDir, name, 'package.json'))
})

for (const name of packageDirs) {
  const dir = join(packagesDir, name)
  const manifest = readJson(join(dir, 'package.json'))
  const isBinding = BINDING_PACKAGES.has(name)

  if (!isBinding) {
    const declared = {
      ...(manifest.dependencies ?? {}),
      ...(manifest.peerDependencies ?? {}),
      ...(manifest.optionalDependencies ?? {}),
    }
    for (const dep of Object.keys(declared)) {
      if (FORBIDDEN.includes(dep)) {
        failures.push(
          `${manifest.name}: declares "${dep}" but is not a binding package. Move the framework code into a binding.`,
        )
      }
    }

    const sourceDir = join(dir, 'src')
    let files = []
    try {
      files = SCAFFOLD_PACKAGES.has(name) ? [] : walk(sourceDir)
    } catch {
      files = []
    }
    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      const match = content.match(IMPORT_PATTERN)
      if (match) {
        failures.push(
          `${file.replace(ROOT, '')}: imports "${match[1]}" from a non-binding package.`,
        )
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Dependency boundary violations:\n')
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  console.error(
    '\nThe engine, ranking, data and server layers must stay framework-free (see docs/architecture/overview.md).',
  )
  process.exit(1)
}

console.log(`Boundary check passed: ${packageDirs.length} package(s) checked, no framework leaks.`)
