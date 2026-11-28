/**
 * Generates docs/reference/api.md from each package's public entry point.
 *
 * The public surface is the entry file plus the relative `export ... from`
 * chain it uses, so internal modules are not documented just because they
 * export something. Parse-only (no TypeScript dependency), no timestamps, and
 * the first JSDoc line as the summary: CI diffs the result for staleness.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const PACKAGES = join(ROOT, 'packages')

const EXPORT_DECL =
  /export\s+(?:declare\s+)?(?:async\s+)?(interface|type|function|class|const|enum)\s+([A-Za-z_$][\w$]*)/g
const NAMED_REEXPORT = /export\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g
const STAR_REEXPORT = /export\s+\*\s+from\s+'([^']+)'/g

function isFile(path) {
  return existsSync(path) && statSync(path).isFile()
}

function resolveModule(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier.replace(/\.js$/, ''))
  // A Svelte component is imported with its extension already in the specifier.
  if (isFile(base)) return base
  for (const extension of ['.ts', '.tsx', '.svelte']) {
    if (isFile(base + extension)) return base + extension
  }
  return null
}

/**
 * Blank out strings, template literals and comments, keeping every offset.
 *
 * Templates package their scaffold contents as template literals, so scanning
 * the raw file found `export const deck` inside a generated file and documented a
 * symbol this package does not export.
 */
function maskSource(source) {
  // Split on UTF-16 code units, not code points: the indices have to line up
  // with `source.indexOf` or a single `—` in a comment shifts everything after it.
  const masked = source.split('')
  const blank = (start, end) => {
    for (let index = start; index < end; index += 1) {
      if (masked[index] !== '\n') masked[index] = ' '
    }
  }

  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index)
      const stop = end === -1 ? source.length : end
      blank(index, stop)
      index = stop
    } else if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      blank(index, stop)
      index = stop
    } else if (char === '"' || char === "'" || char === '`') {
      let end = index + 1
      while (end < source.length) {
        if (source[end] === '\\') {
          end += 2
          continue
        }
        if (source[end] === char) {
          end += 1
          break
        }
        end += 1
      }
      blank(index, end)
      index = end
    } else {
      index += 1
    }
  }

  return masked.join('')
}

function summaryBefore(source, index) {
  const docStart = source.lastIndexOf('/**', index)
  if (docStart === -1) return ''
  const docEnd = source.indexOf('*/', docStart)
  if (docEnd === -1 || docEnd > index) return ''
  if (source.slice(docEnd + 2, index).trim() !== '') return ''
  const block = source.slice(docStart + 3, docEnd)
  const line = block
    .split('\n')
    .map((entry) => entry.replace(/^\s*\*\s?/, '').trim())
    .find(Boolean)
  return line ? line.replace(/\s+/g, ' ') : ''
}

function namedExports(clause) {
  const names = []
  for (const raw of clause.split(',')) {
    const entry = raw.trim().replace(/^type\s+/, '')
    if (!entry) continue
    const [local, alias] = entry.split(/\s+as\s+/)
    if (!local) continue
    names.push({ local: local.trim(), exported: (alias ?? local).trim() })
  }
  return names
}

const visited = new Set()

function collect(file, only = null) {
  const key = `${file}::${only ? [...only].sort().join(',') : '*'}`
  if (visited.has(key)) return new Map()
  visited.add(key)

  const source = readFileSync(file, 'utf8')
  const code = maskSource(source)
  const result = new Map()

  for (const match of code.matchAll(EXPORT_DECL)) {
    const [whole, kind, name] = match
    if (only && !only.has(name)) continue
    const index = match.index ?? 0
    if (!result.has(name)) result.set(name, { kind, summary: summaryBefore(source, index) })
    void whole
  }

  // Re-exports keep their module specifier, which masking would blank out, so
  // these scan the raw source; the masked copy is for declaration keywords only.
  for (const match of source.matchAll(STAR_REEXPORT)) {
    const target = resolveModule(file, match[1])
    if (!target) continue
    for (const [name, info] of collect(target, null)) {
      if (only && !only.has(name)) continue
      if (!result.has(name)) result.set(name, info)
    }
  }

  for (const match of source.matchAll(NAMED_REEXPORT)) {
    const target = resolveModule(file, match[2])
    if (!target) continue
    const entries = namedExports(match[1])
    const locals = new Set(entries.map((entry) => entry.local))
    const targetSymbols = collect(target, locals)
    for (const entry of entries) {
      // A Svelte component is a compiled default export, not a declaration the
      // file spells out, so re-exporting it is documented by kind alone.
      const info =
        entry.local === 'default' && target.endsWith('.svelte')
          ? { kind: 'component', summary: '' }
          : targetSymbols.get(entry.local)
      if (!info) continue
      if (only && !only.has(entry.exported)) continue
      if (!result.has(entry.exported)) result.set(entry.exported, info)
    }
  }

  return result
}

function escapeCell(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '\\|')
}

function tableRows(symbols) {
  return [...symbols.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const { kind, summary } = symbols.get(name)
      return `| \`${name}\` | ${kind} | ${escapeCell(summary)} |`
    })
}

const packageDirs = readdirSync(PACKAGES)
  .map((name) => join(PACKAGES, name))
  .filter((dir) => isFile(join(dir, 'package.json')))
  .sort()

const lines = [
  '# API reference',
  '',
  'Generated by `pnpm api:docs` from each package’s public entry point and the',
  'relative re-export chain it uses. CI fails when this file is stale, so do not',
  'edit it by hand; run the command and commit the result.',
  '',
  'What each symbol promises — contract, supported or internal — is recorded in',
  '[API surface and promises](/reference/api-surface).',
  '',
]

for (const dir of packageDirs) {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const entry = [join(dir, 'src/index.ts'), join(dir, 'src/index.tsx')].find(isFile)
  if (!entry) continue
  visited.clear()
  const symbols = collect(entry, null)
  lines.push(`## \`${manifest.name}\``, '')
  if (manifest.description) lines.push(escapeCell(manifest.description), '')
  const rows = tableRows(symbols)
  if (rows.length === 0) lines.push('_No exports._', '')
  else lines.push('| Symbol | Kind | Summary |', '| --- | --- | --- |', ...rows, '')
}

writeFileSync(join(ROOT, 'docs/reference/api.md'), `${lines.join('\n').trimEnd()}\n`)
console.log('Wrote docs/reference/api.md')
