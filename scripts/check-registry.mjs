/**
 * Validates `registry/adapters.json` and keeps the docs catalog honest.
 *
 * Three checks, because the registry is data that other people's projects read:
 *   1. The entry validates against `registry/schema.json` — the same file
 *      contributors are pointed at, so a mistake shows up as a validation error
 *      rather than a rendering surprise.
 *   2. First-party entries match the workspace package they claim to be: license,
 *      repository directory, and no "passing" conformance for a package this
 *      repository does not test.
 *   3. `docs/adapters/index.md` between the markers is exactly the table this
 *      script renders. `--write` regenerates it.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
export const CATALOG_START = '<!-- registry:start -->'
export const CATALOG_END = '<!-- registry:end -->'

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

function matchesType(value, type) {
  switch (type) {
    case 'object':
      return isObject(value)
    case 'array':
      return Array.isArray(value)
    case 'string':
      return typeof value === 'string'
    case 'boolean':
      return typeof value === 'boolean'
    case 'number':
      return typeof value === 'number'
    case 'integer':
      return Number.isInteger(value)
    default:
      return true
  }
}

function isAbsoluteUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * The JSON Schema subset `registry/schema.json` uses. Small on purpose: a full
 * implementation would be a dependency, and an unused feature in the schema would
 * be silently unchecked by it.
 */
export function validateJson(value, schema, path = '$') {
  const problems = []
  if (!isObject(schema)) return problems

  if ('const' in schema && value !== schema.const) {
    problems.push(`${path}: must be ${JSON.stringify(schema.const)}`)
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    problems.push(`${path}: must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`)
  }
  if (schema.type !== undefined && !matchesType(value, schema.type)) {
    problems.push(`${path}: expected ${schema.type}`)
    return problems
  }

  if (isObject(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) problems.push(`${path}: missing required property "${key}"`)
    }
    const properties = schema.properties ?? {}
    for (const [key, child] of Object.entries(value)) {
      if (properties[key] !== undefined) {
        problems.push(...validateJson(child, properties[key], `${path}.${key}`))
      } else if (schema.additionalProperties === false) {
        problems.push(`${path}: unexpected property "${key}"`)
      }
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      problems.push(`${path}: needs at least ${schema.minItems} item(s)`)
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => {
        problems.push(...validateJson(item, schema.items, `${path}[${index}]`))
      })
    }
  }

  if (typeof value === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      problems.push(`${path}: longer than ${schema.maxLength} characters`)
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      problems.push(`${path}: does not match ${schema.pattern}`)
    }
    if (schema.format === 'uri' && !isAbsoluteUrl(value)) {
      problems.push(`${path}: is not an absolute http(s) URL`)
    }
    if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      problems.push(`${path}: is not a YYYY-MM-DD date`)
    }
  }

  return problems
}

function apiLabel(source) {
  try {
    return new URL(source).hostname.replace(/^www\./, '')
  } catch {
    return source
  }
}

/** The catalog table, without the surrounding markers. */
export function renderCatalog(adapters) {
  const rows = adapters.map((adapter) => {
    const name = adapter.repo
      ? `[\`${adapter.package}\`](${adapter.repo})`
      : `\`${adapter.package}\``
    const attribution = adapter.attributionRequired ? 'Required' : 'Not required'
    return `| ${name} | ${apiLabel(adapter.source)} | ${adapter.license} | ${attribution} | ${adapter.conformance ?? 'unknown'} |`
  })
  return [
    '| Adapter | API | License | Attribution | Conformance |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n')
}

/** Replaces the block between the markers, leaving the prose around it alone. */
export function replaceCatalog(markdown, table) {
  const start = markdown.indexOf(CATALOG_START)
  const end = markdown.indexOf(CATALOG_END)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`docs/adapters/index.md must contain ${CATALOG_START} and ${CATALOG_END}`)
  }
  return `${markdown.slice(0, start + CATALOG_START.length)}\n${table}\n${markdown.slice(end)}`
}

export function extractCatalog(markdown) {
  const start = markdown.indexOf(CATALOG_START)
  const end = markdown.indexOf(CATALOG_END)
  if (start === -1 || end === -1 || end < start) return undefined
  return markdown.slice(start + CATALOG_START.length, end).trim()
}

function workspacePackages(root) {
  const packages = new Map()
  const dir = join(root, 'packages')
  if (!existsSync(dir)) return packages
  for (const entry of readdirSync(dir)) {
    const manifest = join(dir, entry, 'package.json')
    if (!existsSync(manifest)) continue
    const json = JSON.parse(readFileSync(manifest, 'utf8'))
    if (json.name) packages.set(json.name, { directory: entry, ...json })
  }
  return packages
}

export function checkRegistry(root = ROOT) {
  const problems = []
  const registryPath = join(root, 'registry/adapters.json')
  const schemaPath = join(root, 'registry/schema.json')
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'))
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

  problems.push(...validateJson(registry, schema))

  const adapters = Array.isArray(registry.adapters) ? registry.adapters : []
  const workspace = workspacePackages(root)
  const seenNames = new Set()
  const seenPackages = new Set()

  for (const adapter of adapters) {
    const label = adapter.name ?? adapter.package ?? 'unknown'
    if (seenNames.has(adapter.name)) problems.push(`${label}: duplicate name`)
    if (seenPackages.has(adapter.package)) problems.push(`${label}: duplicate package`)
    seenNames.add(adapter.name)
    seenPackages.add(adapter.package)

    const local = workspace.get(adapter.package)
    if (local) {
      if (adapter.license !== local.license) {
        problems.push(
          `${label}: license is "${adapter.license}" but ${adapter.package} is ${local.license}`,
        )
      }
      if (adapter.repo !== undefined && !adapter.repo.endsWith(`packages/${local.directory}`)) {
        problems.push(`${label}: repo does not point at packages/${local.directory}`)
      }
    } else if (adapter.conformance === 'passing') {
      problems.push(
        `${label}: claims passing conformance but ${adapter.package} is not in this workspace`,
      )
    }
  }

  const docsPath = join(root, 'docs/adapters/index.md')
  const docs = existsSync(docsPath) ? readFileSync(docsPath, 'utf8') : ''
  const table = renderCatalog(adapters)
  const current = extractCatalog(docs)
  if (current === undefined) {
    problems.push('docs/adapters/index.md is missing the registry:start / registry:end markers')
  } else if (current !== table) {
    problems.push(
      'docs/adapters/index.md is out of date; run node scripts/check-registry.mjs --write',
    )
  }

  return { problems, adapters, table, docsPath, docs }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes('--write')
  const { problems, adapters, table, docsPath, docs } = checkRegistry()

  if (write) {
    writeFileSync(docsPath, replaceCatalog(docs, table))
    console.log(`Wrote ${adapters.length} adapter(s) into docs/adapters/index.md`)
  }

  const fatal = write ? problems.filter((problem) => !problem.includes('is out of date')) : problems
  if (fatal.length > 0) {
    console.error('Adapter registry problems:\n')
    for (const problem of fatal) console.error(`  ✗ ${problem}`)
    process.exit(1)
  }
  console.log(`Adapter registry OK (${adapters.length} adapter(s)).`)
}
