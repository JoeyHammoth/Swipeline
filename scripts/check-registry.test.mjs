import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  CATALOG_END,
  CATALOG_START,
  checkRegistry,
  extractCatalog,
  renderCatalog,
  replaceCatalog,
  validateJson,
} from './check-registry.mjs'

const SCHEMA = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', pattern: '^[a-z0-9-]+$' },
    repo: { type: 'string', format: 'uri' },
  },
}

const ADAPTER = {
  name: 'openlibrary',
  package: '@swipeline/adapter-openlibrary',
  description: 'Books.',
  source: 'https://openlibrary.org/developers/api',
  license: 'Apache-2.0',
  maintainers: ['JoeyHammoth'],
  attributionRequired: true,
  conformance: 'passing',
}

function fixture({ adapters = [ADAPTER], docs = '', license = 'Apache-2.0' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'swipeline-registry-'))
  mkdirSync(join(root, 'registry'), { recursive: true })
  mkdirSync(join(root, 'docs/adapters'), { recursive: true })
  mkdirSync(join(root, 'packages/adapter-openlibrary'), { recursive: true })
  writeFileSync(
    join(root, 'registry/schema.json'),
    JSON.stringify({
      type: 'object',
      required: ['version', 'adapters'],
      properties: {
        version: { const: 1 },
        adapters: {
          type: 'array',
          items: {
            type: 'object',
            required: ['name', 'package', 'source', 'license', 'conformance'],
            additionalProperties: false,
            properties: {
              name: { type: 'string', pattern: '^[a-z0-9-]+$' },
              package: { type: 'string' },
              source: { type: 'string', format: 'uri' },
              license: { type: 'string' },
              conformance: { enum: ['passing', 'unknown'] },
              repo: { type: 'string', format: 'uri' },
              description: { type: 'string' },
              maintainers: { type: 'array' },
              attributionRequired: { type: 'boolean' },
            },
          },
        },
      },
    }),
  )
  writeFileSync(join(root, 'registry/adapters.json'), JSON.stringify({ version: 1, adapters }))
  writeFileSync(
    join(root, 'packages/adapter-openlibrary/package.json'),
    JSON.stringify({ name: '@swipeline/adapter-openlibrary', version: '0.3.0', license }),
  )
  writeFileSync(
    join(root, 'docs/adapters/index.md'),
    docs || `# Adapters\n\n${CATALOG_START}\n${renderCatalog(adapters)}\n${CATALOG_END}\n`,
  )
  return root
}

function withFixture(options, run) {
  const root = fixture(options)
  try {
    return run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('accepts a registry whose catalog matches the docs', () => {
  withFixture({}, (root) => {
    const { problems, adapters } = checkRegistry(root)
    assert.deepEqual(problems, [])
    assert.equal(adapters.length, 1)
  })
})

test('reports schema violations with a path', () => {
  assert.deepEqual(validateJson({ name: 'Nope' }, SCHEMA), ['$.name: does not match ^[a-z0-9-]+$'])
  assert.deepEqual(validateJson({}, SCHEMA), ['$: missing required property "name"'])
  assert.deepEqual(validateJson({ name: 'ok', extra: 1 }, SCHEMA), [
    '$: unexpected property "extra"',
  ])
  assert.deepEqual(validateJson({ name: 'ok', repo: 'not a url' }, SCHEMA), [
    '$.repo: is not an absolute http(s) URL',
  ])
})

test('reports enum and const mismatches', () => {
  assert.deepEqual(validateJson(2, { const: 1 }), ['$: must be 1'])
  assert.deepEqual(validateJson('bad', { enum: ['passing', 'unknown'] }), [
    '$: must be one of "passing", "unknown"',
  ])
})

test('reports array item problems by index', () => {
  assert.deepEqual(
    validateJson([{ name: 'ok' }, { name: 'BAD' }], { type: 'array', items: SCHEMA }),
    ['$[1].name: does not match ^[a-z0-9-]+$'],
  )
  assert.deepEqual(validateJson([], { type: 'array', items: SCHEMA, minItems: 1 }), [
    '$: needs at least 1 item(s)',
  ])
})

test('fails when an entry claims a license its package does not carry', () => {
  withFixture({ license: 'MIT' }, (root) => {
    const { problems } = checkRegistry(root)
    assert.deepEqual(problems, [
      'openlibrary: license is "Apache-2.0" but @swipeline/adapter-openlibrary is MIT',
    ])
  })
})

test('fails when the repo link does not point at the package directory', () => {
  const adapters = [{ ...ADAPTER, repo: 'https://github.com/x/y/tree/main/packages/other' }]
  withFixture({ adapters }, (root) => {
    const { problems } = checkRegistry(root)
    assert.deepEqual(problems, ['openlibrary: repo does not point at packages/adapter-openlibrary'])
  })
})

test('fails when a third-party entry claims passing conformance', () => {
  const adapters = [{ ...ADAPTER, package: 'swipeline-adapter-somewhere', name: 'somewhere' }]
  withFixture({ adapters }, (root) => {
    const { problems } = checkRegistry(root)
    assert.deepEqual(problems, [
      'somewhere: claims passing conformance but swipeline-adapter-somewhere is not in this workspace',
    ])
  })
})

test('fails on a duplicate name', () => {
  withFixture({ adapters: [ADAPTER, { ...ADAPTER, package: 'other' }] }, (root) => {
    const { problems } = checkRegistry(root)
    assert.ok(problems.includes('openlibrary: duplicate name'))
  })
})

test('fails when the docs catalog drifts', () => {
  withFixture(
    {
      docs: `# Adapters\n\n${CATALOG_START}\n| stale | table |\n${CATALOG_END}\n`,
    },
    (root) => {
      const { problems } = checkRegistry(root)
      assert.deepEqual(problems, [
        'docs/adapters/index.md is out of date; run node scripts/check-registry.mjs --write',
      ])
    },
  )
})

test('fails when the markers are missing', () => {
  withFixture({ docs: '# Adapters\n\nNo markers here.\n' }, (root) => {
    const { problems } = checkRegistry(root)
    assert.deepEqual(problems, [
      'docs/adapters/index.md is missing the registry:start / registry:end markers',
    ])
  })
})

test('renders and replaces the catalog between the markers', () => {
  const table = renderCatalog([
    {
      name: 'tmdb',
      package: '@swipeline/adapter-tmdb',
      source: 'https://www.themoviedb.org',
      repo: 'https://github.com/JoeyHammoth/Swipeline/tree/main/packages/adapter-tmdb',
      license: 'Apache-2.0',
      attributionRequired: true,
      conformance: 'passing',
    },
  ])
  assert.match(table, /^\| Adapter \| API \| License \| Attribution \| Conformance \|/m)
  assert.match(table, /\| \[`@swipeline\/adapter-tmdb`\]/)

  const wrapped = `# Adapters\n\n${CATALOG_START}\nold\n${CATALOG_END}\n\nKeep me.\n`
  const next = replaceCatalog(wrapped, table)
  assert.equal(extractCatalog(next), table)
  assert.match(next, /Keep me\./)
  assert.doesNotMatch(next, /\nold\n/)
})

test('refuses to replace a catalog with no markers', () => {
  assert.throws(() => replaceCatalog('# Adapters\n', 'table'), /must contain/)
})
