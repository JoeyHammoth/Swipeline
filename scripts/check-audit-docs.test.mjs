import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { checkAuditDocs } from './check-audit-docs.mjs'

const DOC = `# Accessibility audit

Run on 2026-11-27, Chromium, \`PLAYWRIGHT_CHANNEL=chrome pnpm e2e\` — 24 tests, all
passing.

**axe**, with the tags \`wcag2a\`, \`wcag2aa\`, \`wcag21a\`, \`wcag21aa\` and \`wcag22aa\`:

- **Binding conformance.** 7/7 checks per binding in the same run.

Last run 2026-11-27: 4/4 pages, 0 violations.
`

const AXE = `export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] as const`

const CONFORMANCE = `expect(report).toEqual({ binding: name, checks: 7 })`

const EXAMPLES = `const APPS = [
  { name: 'books-react', port: 4181 },
  { name: 'recipes-react', port: 4182 },
  { name: 'movies-tmdb', port: 4183 },
  { name: 'papers-html', port: 4184 },
] as const`

function write(root, path, content) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

/** A throwaway repository root with the four files the checker reads. */
function fixture(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'swipeline-audit-docs-'))
  const files = {
    'docs/reference/a11y-audit.md': DOC,
    'e2e/axe.ts': AXE,
    'e2e/binding-conformance.spec.ts': CONFORMANCE,
    'e2e/examples/example-apps.spec.ts': EXAMPLES,
    ...overrides,
  }
  for (const [path, content] of Object.entries(files)) write(root, path, content)
  return root
}

function withFixture(run, overrides) {
  const root = fixture(overrides)
  try {
    return run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

const report = (stats) => ({ stats: { expected: 24, unexpected: 0, skipped: 0, ...stats } })

test('accepts an audit page that matches the suite and the run', () => {
  withFixture((root) => {
    assert.deepEqual(checkAuditDocs(root, { report: report() }).problems, [])
  })
})

test('fails when the run executed more tests than the page records', () => {
  withFixture((root) => {
    const { problems } = checkAuditDocs(root, { report: report({ expected: 28 }) })
    assert.deepEqual(problems, [
      'docs/reference/a11y-audit.md records 24 fixture tests; the fixture run executed 28',
    ])
  })
})

test('fails when the run had a failure or a skip', () => {
  withFixture((root) => {
    const { problems } = checkAuditDocs(root, {
      report: report({ unexpected: 1, skipped: 2 }),
    })
    assert.deepEqual(problems, ['fixture run: 1 test failed', 'fixture run: 2 tests skipped'])
  })
})

test('fails when the axe tag set changed in the code', () => {
  withFixture(
    (root) => {
      const { problems } = checkAuditDocs(root, { report: report() })
      assert.deepEqual(problems, [
        'docs/reference/a11y-audit.md lists axe tags wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa; e2e/axe.ts runs wcag2a, wcag2aa, wcag21a, wcag21aa',
      ])
    },
    { 'e2e/axe.ts': `export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']` },
  )
})

test('fails when a binding reports a different number of checks', () => {
  withFixture(
    (root) => {
      const { problems } = checkAuditDocs(root, { report: report() })
      assert.deepEqual(problems, [
        'docs/reference/a11y-audit.md records 7/7 conformance checks; e2e/binding-conformance.spec.ts reports 8',
      ])
    },
    { 'e2e/binding-conformance.spec.ts': 'expect(report).toEqual({ binding: name, checks: 8 })' },
  )
})

test('fails when the example app list and the page disagree', () => {
  withFixture(
    (root) => {
      const { problems } = checkAuditDocs(root, { report: report() })
      assert.deepEqual(problems, [
        'docs/reference/a11y-audit.md records 4 example pages; e2e/examples/example-apps.spec.ts defines 3',
      ])
    },
    {
      'e2e/examples/example-apps.spec.ts': `const APPS = [
  { name: 'books-react', port: 4181 },
  { name: 'recipes-react', port: 4182 },
  { name: 'movies-tmdb', port: 4183 },
] as const`,
    },
  )
})

test('fails when there is no run report to compare against', () => {
  withFixture((root) => {
    const { problems } = checkAuditDocs(root)
    assert.deepEqual(problems, ['no fixture run report to compare; run pnpm e2e first'])
  })
})

test('compares the example run with the recorded page count', () => {
  withFixture((root) => {
    assert.deepEqual(
      checkAuditDocs(root, { report: report({ expected: 4 }), examples: true }).problems,
      [],
    )
  })
})

test('fails when the example run covered fewer pages than recorded', () => {
  withFixture((root) => {
    const { problems } = checkAuditDocs(root, { report: report({ expected: 3 }), examples: true })
    assert.deepEqual(problems, [
      'docs/reference/a11y-audit.md records 4 example pages; the example run executed 3',
    ])
  })
})

test('fails when the page has no counts left to compare', () => {
  withFixture(
    (root) => {
      const { problems } = checkAuditDocs(root, { report: report() })
      assert.deepEqual(problems, [
        'docs/reference/a11y-audit.md: no "with the tags" list to compare the axe rule set against',
        'docs/reference/a11y-audit.md: no "N/N checks per binding" result to compare',
        'docs/reference/a11y-audit.md: no "N/N pages" result to compare',
        'docs/reference/a11y-audit.md: no "N tests, all passing" result to compare the run against',
      ])
    },
    { 'docs/reference/a11y-audit.md': '# Accessibility audit\n' },
  )
})
