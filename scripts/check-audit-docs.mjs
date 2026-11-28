/**
 * Keeps `docs/reference/a11y-audit.md` honest about what the browser suite
 * actually does.
 *
 * The audit page records results, not intentions: a tag list, a test count, a
 * conformance count and a page count. Those numbers go stale the moment a spec
 * gains a test or the axe tag set changes, and a wrong number in an audit is
 * worse than no number. This compares the page with the code, and with the JSON
 * report Playwright writes during the nightly run, so the claim and the run cannot
 * drift apart unnoticed.
 *
 * Usage:
 *   pnpm audit:docs              # after `pnpm e2e`
 *   pnpm audit:docs --examples   # after `pnpm e2e:examples`
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DOC = 'docs/reference/a11y-audit.md'
const AXE = 'e2e/axe.ts'
const CONFORMANCE = 'e2e/binding-conformance.spec.ts'
const EXAMPLES = 'e2e/examples/example-apps.spec.ts'
const REPORTS = {
  fixtures: 'test-results/audit-fixtures.json',
  examples: 'test-results/audit-examples.json',
}

/** Every backticked token on the line that lists the axe tag set. */
function claimedTags(markdown) {
  const line = markdown.split('\n').find((text) => text.includes('with the tags'))
  if (!line) return undefined
  return [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1])
}

/** The first capture of `pattern`, as a number. */
function number(markdown, pattern) {
  const match = markdown.match(pattern)
  return match ? Number(match[1]) : undefined
}

/** `N/N <unit>` claims must agree with themselves; returns N or undefined. */
function ratio(markdown, pattern, unit) {
  const match = markdown.match(pattern)
  if (!match) return undefined
  return { value: Number(match[1]), total: Number(match[2]), unit }
}

/** The tags `e2e/axe.ts` runs. */
function codedTags(source) {
  const array = source.match(/WCAG_TAGS\s*=\s*\[([^\]]*)\]/)
  if (!array) return undefined
  return [...array[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
}

/** The number of checks each binding reports in `e2e/binding-conformance.spec.ts`. */
function codedConformanceChecks(source) {
  const match = source.match(/checks:\s*(\d+)/)
  return match ? Number(match[1]) : undefined
}

/** The example apps `e2e/examples/example-apps.spec.ts` scans. */
function codedExampleApps(source) {
  return [...source.matchAll(/name:\s*'([^']+)'/g)].map((match) => match[1])
}

/** What Playwright's JSON reporter says a run did. */
function runStats(report) {
  const stats = report?.stats ?? {}
  return {
    expected: Number(stats.expected ?? 0),
    unexpected: Number(stats.unexpected ?? 0),
    skipped: Number(stats.skipped ?? 0),
  }
}

/**
 * Compare the audit page with the suite and, when given one, with a run report.
 *
 * `report` is the parsed JSON Playwright writes; tests inject it so they never
 * need a browser.
 */
export function checkAuditDocs(root, { report, examples = false } = {}) {
  const problems = []
  const markdown = readFileSync(join(root, DOC), 'utf8')
  const suite = examples ? 'example' : 'fixture'

  const tags = claimedTags(markdown)
  const axeTags = codedTags(readFileSync(join(root, AXE), 'utf8'))
  if (!tags) {
    problems.push(`${DOC}: no "with the tags" list to compare the axe rule set against`)
  } else if (!axeTags) {
    problems.push(`${AXE}: no WCAG_TAGS array to compare the audit page against`)
  } else if (tags.join(',') !== axeTags.join(',')) {
    problems.push(`${DOC} lists axe tags ${tags.join(', ')}; ${AXE} runs ${axeTags.join(', ')}`)
  }

  const conformance = ratio(markdown, /(\d+)\/(\d+) checks per binding/, 'checks')
  const checks = codedConformanceChecks(readFileSync(join(root, CONFORMANCE), 'utf8'))
  if (!conformance) {
    problems.push(`${DOC}: no "N/N checks per binding" result to compare`)
  } else if (conformance.value !== conformance.total) {
    problems.push(`${DOC} records ${conformance.value}/${conformance.total} conformance checks`)
  } else if (checks !== conformance.value) {
    problems.push(
      `${DOC} records ${conformance.value}/${conformance.total} conformance checks; ${CONFORMANCE} reports ${checks ?? 'none'}`,
    )
  }

  const pages = ratio(markdown, /(\d+)\/(\d+) pages, 0 violations/, 'pages')
  const apps = codedExampleApps(readFileSync(join(root, EXAMPLES), 'utf8'))
  if (!pages) {
    problems.push(`${DOC}: no "N/N pages" result to compare`)
  } else if (pages.value !== pages.total) {
    problems.push(`${DOC} records ${pages.value}/${pages.total} example pages`)
  } else if (apps.length !== pages.value) {
    problems.push(`${DOC} records ${pages.value} example pages; ${EXAMPLES} defines ${apps.length}`)
  }

  const documented = examples ? pages?.value : number(markdown, /(\d+) tests, all\s+passing/)
  if (documented === undefined) {
    problems.push(
      `${DOC}: no "${examples ? 'N/N pages' : 'N tests, all passing'}" result to compare the run against`,
    )
  }

  if (!report) {
    problems.push(
      `no ${suite} run report to compare; run pnpm e2e${examples ? ':examples' : ''} first`,
    )
    return { problems }
  }

  const stats = runStats(report)
  if (stats.unexpected > 0) {
    problems.push(
      `${suite} run: ${stats.unexpected} test${stats.unexpected === 1 ? '' : 's'} failed`,
    )
  }
  if (stats.skipped > 0) {
    problems.push(`${suite} run: ${stats.skipped} test${stats.skipped === 1 ? '' : 's'} skipped`)
  }
  if (documented !== undefined && stats.expected !== documented) {
    problems.push(
      `${DOC} records ${documented} ${examples ? 'example pages' : 'fixture tests'}; the ${suite} run executed ${stats.expected}`,
    )
  }

  return { problems }
}

/** Read the report at `path`, if the run wrote one. */
function readReport(path) {
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8'))
}

function main() {
  const args = process.argv.slice(2)
  const unknown = args.filter((arg) => arg !== '--examples')
  if (unknown.length > 0) {
    console.error(`Unknown argument${unknown.length === 1 ? '' : 's'}: ${unknown.join(' ')}`)
    console.error('Usage: pnpm audit:docs [--examples]')
    process.exit(2)
  }

  const examples = args.includes('--examples')
  const suite = examples ? 'examples' : 'fixtures'
  const report = readReport(join(process.cwd(), REPORTS[suite]))
  const { problems } = checkAuditDocs(process.cwd(), {
    ...(report ? { report } : {}),
    examples,
  })

  if (problems.length > 0) {
    console.error('The accessibility audit page does not match the suite:\n')
    for (const problem of problems) console.error(`  ✗ ${problem}`)
    process.exit(1)
  }

  console.log(
    examples
      ? 'Audit docs match the suite: the example run scanned every page the page records.'
      : 'Audit docs match the suite: the fixture run executed the tests, axe tags and conformance checks the page records.',
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
