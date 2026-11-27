import { constants, existsSync } from 'node:fs'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { BenchReport, StrategyName } from '@swipeline/bench'
import { runBenchmark } from '@swipeline/bench'
import {
  type EventQuery,
  MemoryEventStore,
  parseSwipeEvent,
  type SwipeEvent,
} from '@swipeline/core'
import { createServer } from '@swipeline/server'
import { createSqliteStores } from '@swipeline/store-sqlite'
import { createDevServer } from './dev.js'
import {
  addSource,
  CONFIG_FILE,
  frameworkHint,
  initDeck,
  loadManifest,
  TEMPLATE_NAMES,
  type TemplateName,
} from './init.js'

export const USAGE = `swipeline - decks from any source, ranked locally

Usage:
  swipeline init [dir] [--template <name>] [--id <deckId>] [--force]
  swipeline source add <url> [--id <sourceId>] [--config <file>] [--deck <deckId>]
  swipeline dev [--config <file>] [--port <port>] [--db <file>] [--actor <id>]
  swipeline serve [--port <port>] [--host <host>] [--cors <origin>]... [--db <file>]
  swipeline validate <history.jsonl>
  swipeline export <swipes.db> [--actor <id>] [--deck <id>] [--since <iso>] [--until <iso>] [--after <ulid>] [--limit <n>] [--out <file>]
  swipeline import <swipes.db> <history.jsonl>
  swipeline doctor [--db <file>]
  swipeline bench [--seed <n>] [--users <n>] [--cards <n>] [--k <n>] [--gate]
  swipeline help

init      Write a deck manifest into a project.
source    Add or replace the source mapping in a deck manifest.
dev       Preview a deck against its source and record swipes locally.
serve     Run the HTTP API, optionally backed by a SQLite file.
validate  Check a JSONL history export against the SwipeEvent schema.
export    Write a stored history as JSONL.
import    Append a JSONL history to a SQLite database.
doctor    Report the runtime and storage state this CLI will use.
bench     Run the synthetic-user benchmark against the default pipeline.

Exit codes: 0 success, 1 failure, 2 bad usage, 3 benchmark regression.
`

export interface CliIo {
  stdout(line: string): void
  stderr(line: string): void
}

export interface ServeOptions {
  port: number
  host: string
  cors: string[]
  /** SQLite file to persist the event log. Absent means memory-only. */
  db?: string
}

export type ServeParse = { ok: true; options: ServeOptions } | { ok: false; message: string }

export interface HistoryValidation {
  events: SwipeEvent[]
  errors: { line: number; message: string }[]
}

/** Runs the benchmark. Injected in tests so `swipeline bench` is not slow. */
export type BenchRunner = (options: {
  seed?: number
  users?: number
  cards?: number
  k?: number
}) => Promise<BenchReport>

/** Everything the commands reach outside the process, so tests can replace it. */
export interface CliDeps {
  benchmark?: BenchRunner
  fetch?: typeof globalThis.fetch
}

const consoleIo: CliIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
}

const BASELINES: readonly StrategyName[] = ['random', 'popularity', 'tagOnly']
const MINIMUM_NODE_MAJOR = 24

type FlagKind = 'string' | 'integer' | 'strings' | 'boolean'
type FlagValue = string | number | string[] | true

interface ParsedFlags {
  ok: true
  flags: Record<string, FlagValue>
  positionals: string[]
}

type FlagParse = ParsedFlags | { ok: false; message: string }

function parseFlags(args: readonly string[], spec: Record<string, FlagKind>): FlagParse {
  const flags: Record<string, FlagValue> = {}
  const positionals: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === undefined) continue
    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }

    const name = arg.slice(2)
    const kind = spec[name]
    if (!kind) return { ok: false, message: `Unknown option: ${arg}` }
    if (kind === 'boolean') {
      flags[name] = true
      continue
    }

    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) {
      return { ok: false, message: `${arg} needs a value` }
    }
    index += 1

    if (kind === 'strings') {
      const current = flags[name]
      flags[name] = Array.isArray(current) ? [...current, value] : [value]
      continue
    }

    if (kind === 'integer') {
      if (!/^\d+$/.test(value)) return { ok: false, message: `${arg} needs a number` }
      flags[name] = Number(value)
      continue
    }

    flags[name] = value
  }

  return { ok: true, flags, positionals }
}

function messageOf(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'issues' in cause) {
    const issues = (cause as { issues?: { path?: (string | number)[]; message?: string }[] }).issues
    const first = issues?.[0]
    if (first) {
      const path = first.path?.length ? `${first.path.join('.')}: ` : ''
      return `${path}${first.message ?? 'invalid event'}`
    }
  }
  return cause instanceof Error ? cause.message : String(cause)
}

function stringFlag(flags: Record<string, FlagValue>, name: string): string | undefined {
  const value = flags[name]
  return typeof value === 'string' ? value : undefined
}

function numberFlag(flags: Record<string, FlagValue>, name: string): number | undefined {
  const value = flags[name]
  return typeof value === 'number' ? value : undefined
}

export function parseServeOptions(args: readonly string[]): ServeParse {
  const parsed = parseFlags(args, {
    port: 'integer',
    host: 'string',
    cors: 'strings',
    db: 'string',
  })
  if (!parsed.ok) return parsed
  const [extra] = parsed.positionals
  if (extra !== undefined) return { ok: false, message: `Unexpected argument: ${extra}` }

  const port = numberFlag(parsed.flags, 'port')
  if (port !== undefined && port > 65_535) {
    return { ok: false, message: '--port must be 65535 or lower' }
  }

  const options: ServeOptions = {
    port: port ?? 8787,
    host: stringFlag(parsed.flags, 'host') ?? '127.0.0.1',
    cors: (parsed.flags.cors as string[] | undefined) ?? [],
  }
  const db = stringFlag(parsed.flags, 'db')
  if (db !== undefined) options.db = db
  return { ok: true, options }
}

/**
 * Reads a JSONL history export and validates every non-empty line against the
 * `SwipeEvent` schema. Errors carry the line number so a bad export can be fixed
 * rather than silently dropped.
 */
export async function validateHistoryFile(path: string): Promise<HistoryValidation> {
  const text = await readFile(path, 'utf8')
  const events: SwipeEvent[] = []
  const errors: { line: number; message: string }[] = []

  text.split('\n').forEach((raw, index) => {
    const line = raw.trim()
    if (line === '') return
    try {
      const parsed: unknown = JSON.parse(line)
      events.push(parseSwipeEvent(parsed))
    } catch (cause) {
      errors.push({ line: index + 1, message: messageOf(cause) })
    }
  })

  return { events, errors }
}

function waitForSignal(): Promise<void> {
  return new Promise<void>((resolve) => {
    process.once('SIGINT', () => resolve())
    process.once('SIGTERM', () => resolve())
  })
}

async function serve(args: readonly string[], io: CliIo): Promise<number> {
  const parsed = parseServeOptions(args)
  if (!parsed.ok) {
    io.stderr(parsed.message)
    return 2
  }

  const stores = parsed.options.db ? createSqliteStores({ path: parsed.options.db }) : undefined
  const server = createServer({
    events: stores?.events ?? new MemoryEventStore(),
    ...(parsed.options.cors.length > 0 ? { cors: parsed.options.cors } : {}),
  })

  try {
    const running = await server.listen(parsed.options.port, parsed.options.host)
    io.stdout(`swipeline server listening on ${running.url}`)
    io.stdout(
      parsed.options.db
        ? `Using SQLite at ${parsed.options.db}: history survives a restart.`
        : 'Using the in-memory event log: history is lost when this process exits.',
    )
    await waitForSignal()
    await running.close()
    io.stdout('Server stopped.')
    return 0
  } finally {
    stores?.close()
  }
}

async function validate(args: readonly string[], io: CliIo): Promise<number> {
  const [file] = args
  if (!file || args.length > 1) {
    io.stderr('validate needs exactly one JSONL file')
    return 2
  }

  let result: HistoryValidation
  try {
    result = await validateHistoryFile(file)
  } catch (cause) {
    io.stderr(`Could not read ${file}: ${messageOf(cause)}`)
    return 1
  }

  for (const error of result.errors) io.stderr(`line ${error.line}: ${error.message}`)
  if (result.errors.length > 0) {
    io.stderr(`${result.errors.length} invalid line(s).`)
    return 1
  }

  io.stdout(`${result.events.length} event(s) valid.`)
  return 0
}

function exportQuery(flags: Record<string, FlagValue>): EventQuery {
  const query: EventQuery = {}
  const actor = stringFlag(flags, 'actor')
  const deckId = stringFlag(flags, 'deck')
  const since = stringFlag(flags, 'since')
  const until = stringFlag(flags, 'until')
  const after = stringFlag(flags, 'after')
  const limit = numberFlag(flags, 'limit')
  if (actor !== undefined) query.actor = actor
  if (deckId !== undefined) query.deckId = deckId
  if (since !== undefined) query.since = since
  if (until !== undefined) query.until = until
  if (after !== undefined) query.afterId = after
  if (limit !== undefined) query.limit = limit
  return query
}

async function exportHistory(args: readonly string[], io: CliIo): Promise<number> {
  const parsed = parseFlags(args, {
    actor: 'string',
    deck: 'string',
    since: 'string',
    until: 'string',
    after: 'string',
    limit: 'integer',
    out: 'string',
  })
  if (!parsed.ok) {
    io.stderr(parsed.message)
    return 2
  }

  const [path] = parsed.positionals
  if (path === undefined || parsed.positionals.length > 1) {
    io.stderr('export needs exactly one SQLite database')
    return 2
  }
  if (!existsSync(path)) {
    io.stderr(`No such database: ${path}`)
    return 1
  }

  const stores = createSqliteStores({ path })
  try {
    const events = await stores.events.export(exportQuery(parsed.flags))
    const text =
      events.length > 0 ? `${events.map((event) => JSON.stringify(event)).join('\n')}\n` : ''
    const out = stringFlag(parsed.flags, 'out')
    if (out !== undefined) {
      await writeFile(out, text, 'utf8')
      io.stdout(`${events.length} event(s) written to ${out}.`)
      return 0
    }
    for (const line of text.split('\n')) {
      if (line !== '') io.stdout(line)
    }
    // The summary goes to stderr so `swipeline export db > history.jsonl` stays clean.
    io.stderr(`${events.length} event(s) exported.`)
    return 0
  } catch (cause) {
    io.stderr(`Could not export from ${path}: ${messageOf(cause)}`)
    return 1
  } finally {
    stores.close()
  }
}

async function importHistory(args: readonly string[], io: CliIo): Promise<number> {
  const [path, file] = args
  if (path === undefined || file === undefined || args.length > 2) {
    io.stderr('import needs a SQLite database and one JSONL file')
    return 2
  }

  let result: HistoryValidation
  try {
    result = await validateHistoryFile(file)
  } catch (cause) {
    io.stderr(`Could not read ${file}: ${messageOf(cause)}`)
    return 1
  }

  for (const error of result.errors) io.stderr(`line ${error.line}: ${error.message}`)
  if (result.errors.length > 0) {
    // All or nothing: a half-imported history is harder to reason about than a
    // rejected one, and the file can simply be fixed and re-run.
    io.stderr(`${result.errors.length} invalid line(s); nothing imported.`)
    return 1
  }

  const stores = createSqliteStores({ path })
  try {
    const before = (await stores.events.query({})).length
    await stores.events.append(result.events)
    const after = (await stores.events.query({})).length
    io.stdout(`${after - before} new event(s) imported from ${file} (${after} total).`)
    return 0
  } catch (cause) {
    io.stderr(`Could not import into ${path}: ${messageOf(cause)}`)
    return 1
  } finally {
    stores.close()
  }
}

async function writable(directory: string): Promise<boolean> {
  try {
    await access(directory, constants.W_OK)
    return true
  } catch {
    return false
  }
}

async function packageVersion(): Promise<string> {
  try {
    const text = await readFile(new URL('../package.json', import.meta.url), 'utf8')
    return (JSON.parse(text) as { version?: string }).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

async function doctor(args: readonly string[], io: CliIo): Promise<number> {
  const parsed = parseFlags(args, { db: 'string' })
  if (!parsed.ok) {
    io.stderr(parsed.message)
    return 2
  }
  const [extra] = parsed.positionals
  if (extra !== undefined) {
    io.stderr(`Unexpected argument: ${extra}`)
    return 2
  }

  const major = Number(process.versions.node.split('.')[0])
  io.stdout(`swipeline ${await packageVersion()}`)
  io.stdout(`node ${process.version} (>=${MINIMUM_NODE_MAJOR} required)`)
  io.stdout(`fetch: ${typeof globalThis.fetch === 'function' ? 'available' : 'missing'}`)
  if (major < MINIMUM_NODE_MAJOR) {
    io.stderr(`node ${MINIMUM_NODE_MAJOR} or newer is required; this is ${process.version}.`)
    return 1
  }

  const path = stringFlag(parsed.flags, 'db')
  if (path === undefined) {
    io.stdout('database: none (serve and import create one when you pass --db)')
    return 0
  }
  if (!existsSync(path)) {
    io.stdout(`database: ${path} (does not exist yet)`)
    io.stdout(`directory writable: ${(await writable(dirname(path))) ? 'yes' : 'no'}`)
    return 0
  }

  const stores = createSqliteStores({ path })
  try {
    const events = (await stores.events.query({})).length
    io.stdout(`database: ${path} (schema ${stores.schemaVersion}, ${events} event(s))`)
    io.stdout(`directory writable: ${(await writable(dirname(path))) ? 'yes' : 'no'}`)
    return 0
  } catch (cause) {
    io.stderr(`Could not open ${path}: ${messageOf(cause)}`)
    return 1
  } finally {
    stores.close()
  }
}

function formatMetric(value: number | null): string {
  return value === null ? '-' : value.toFixed(3)
}

function reportTable(report: BenchReport): string[] {
  const rows = Object.entries(report.strategies).map(([name, metrics]) => [
    name.padEnd(12),
    metrics.precisionAtK.toFixed(3),
    formatMetric(metrics.timeToFirstLike),
    metrics.diversity.toFixed(3),
  ])
  return [
    `${'strategy'.padEnd(12)} precision@k  timeToFirstLike  diversity`,
    ...rows.map((cells) => cells.join('  ')),
  ]
}

async function bench(args: readonly string[], io: CliIo, runner: BenchRunner): Promise<number> {
  const parsed = parseFlags(args, {
    seed: 'integer',
    users: 'integer',
    cards: 'integer',
    k: 'integer',
    gate: 'boolean',
  })
  if (!parsed.ok) {
    io.stderr(parsed.message)
    return 2
  }
  const [extra] = parsed.positionals
  if (extra !== undefined) {
    io.stderr(`Unexpected argument: ${extra}`)
    return 2
  }

  const options: Parameters<BenchRunner>[0] = {}
  const seed = numberFlag(parsed.flags, 'seed')
  const users = numberFlag(parsed.flags, 'users')
  const cards = numberFlag(parsed.flags, 'cards')
  const k = numberFlag(parsed.flags, 'k')
  if (seed !== undefined) options.seed = seed
  if (users !== undefined) options.users = users
  if (cards !== undefined) options.cards = cards
  if (k !== undefined) options.k = k

  const report = await runner(options)
  for (const line of reportTable(report)) io.stdout(line)

  if (parsed.flags.gate !== true) return 0

  const best = Math.max(...BASELINES.map((name) => report.strategies[name].precisionAtK))
  const bestName =
    BASELINES.find((name) => report.strategies[name].precisionAtK === best) ?? 'random'
  if (report.strategies.default.precisionAtK <= best) {
    io.stderr(
      `default precision@${report.k} (${report.strategies.default.precisionAtK.toFixed(3)}) did not beat the best baseline (${bestName} ${best.toFixed(3)}).`,
    )
    return 3
  }
  io.stderr(
    `default precision@${report.k} (${report.strategies.default.precisionAtK.toFixed(3)}) beats the best baseline (${bestName} ${best.toFixed(3)}).`,
  )
  return 0
}

async function init(args: readonly string[], io: CliIo): Promise<number> {
  const parsed = parseFlags(args, { template: 'string', id: 'string', force: 'boolean' })
  if (!parsed.ok) {
    io.stderr(parsed.message)
    return 2
  }
  const [directory = '.'] = parsed.positionals
  if (parsed.positionals.length > 1) {
    io.stderr('init takes at most one directory')
    return 2
  }

  const template = (stringFlag(parsed.flags, 'template') ?? 'books') as TemplateName
  if (!TEMPLATE_NAMES.includes(template)) {
    io.stderr(`Unknown template: ${template}. Choose one of ${TEMPLATE_NAMES.join(', ')}.`)
    return 2
  }

  const id = stringFlag(parsed.flags, 'id')
  const result = await initDeck({
    directory,
    template,
    ...(id === undefined ? {} : { id }),
    ...(parsed.flags.force === true ? { force: true } : {}),
  })
  if (!result.created) {
    io.stderr(`${result.path} already exists; pass --force to replace it.`)
    return 1
  }

  io.stdout(`Wrote ${result.path} (${template} template, deck id ${result.manifest.id}).`)
  io.stdout(`Framework detected: ${result.framework}.`)
  io.stdout(`Preview it: swipeline dev --config ${result.path}`)
  io.stdout(frameworkHint(result.framework))
  return 0
}

async function sourceAdd(args: readonly string[], io: CliIo, deps: CliDeps): Promise<number> {
  const parsed = parseFlags(args, { id: 'string', config: 'string', deck: 'string' })
  if (!parsed.ok) {
    io.stderr(parsed.message)
    return 2
  }
  const [url] = parsed.positionals
  if (url === undefined || parsed.positionals.length > 1) {
    io.stderr('source add needs exactly one URL')
    return 2
  }

  const id = stringFlag(parsed.flags, 'id')
  const deckId = stringFlag(parsed.flags, 'deck')
  let result: Awaited<ReturnType<typeof addSource>>
  try {
    result = await addSource({
      url,
      configPath: stringFlag(parsed.flags, 'config') ?? CONFIG_FILE,
      ...(id === undefined ? {} : { id }),
      ...(deckId === undefined ? {} : { deckId }),
      ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
    })
  } catch (cause) {
    io.stderr(`Could not map ${url}: ${messageOf(cause)}`)
    return 1
  }

  io.stdout(`Wrote ${result.path}.`)
  const items = result.source.itemsPath ?? '(the response)'
  io.stdout(`source: ${result.source.id}, itemsPath: ${items}`)
  io.stdout(`map: ${JSON.stringify(result.source.map)}`)
  for (const card of result.cards) {
    io.stdout(`  preview: ${card.title}${card.subtitle ? ` — ${card.subtitle}` : ''}`)
  }
  if (result.dropped > 0) io.stderr(`${result.dropped} sample row(s) did not map to a card.`)
  return 0
}

async function dev(args: readonly string[], io: CliIo, deps: CliDeps): Promise<number> {
  const parsed = parseFlags(args, {
    config: 'string',
    port: 'integer',
    db: 'string',
    actor: 'string',
  })
  if (!parsed.ok) {
    io.stderr(parsed.message)
    return 2
  }
  const [extra] = parsed.positionals
  if (extra !== undefined) {
    io.stderr(`Unexpected argument: ${extra}`)
    return 2
  }

  const configPath = stringFlag(parsed.flags, 'config') ?? CONFIG_FILE
  let manifest: Awaited<ReturnType<typeof loadManifest>>
  try {
    manifest = await loadManifest(configPath)
  } catch (cause) {
    io.stderr(`Could not read ${configPath}: ${messageOf(cause)}. Run swipeline init first.`)
    return 1
  }

  const db = stringFlag(parsed.flags, 'db') ?? '.swipeline/dev.db'
  await mkdir(dirname(db), { recursive: true })
  const stores = createSqliteStores({ path: db })
  const port = numberFlag(parsed.flags, 'port')
  const actor = stringFlag(parsed.flags, 'actor')

  try {
    const running = await createDevServer({
      manifest,
      stores,
      ...(port === undefined ? {} : { port }),
      ...(actor === undefined ? {} : { actor }),
      ...(deps.fetch === undefined ? {} : { fetch: deps.fetch }),
    })
    io.stdout(`swipeline dev listening on ${running.url}`)
    io.stdout(`Loaded ${running.cards.length} card(s) from ${manifest.source.id}.`)
    io.stdout(`Swipes are appended to ${db}; Ctrl-C stops the server.`)
    await waitForSignal()
    await running.close()
    io.stdout('Stopped.')
    return 0
  } catch (cause) {
    io.stderr(messageOf(cause))
    return 1
  } finally {
    stores.close()
  }
}

/** Entry point for tests and for the `swipeline` bin. Returns the exit code. */
export async function run(
  argv: readonly string[],
  io: CliIo = consoleIo,
  deps: CliDeps = {},
): Promise<number> {
  const [command, ...rest] = argv

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    io.stdout(USAGE)
    return 0
  }

  if (command === 'init') return init(rest, io)
  if (command === 'source') {
    const [subcommand, ...args] = rest
    if (subcommand !== 'add') {
      io.stderr(`Unknown source command: ${subcommand ?? ''}. Try: swipeline source add <url>`)
      return 2
    }
    return sourceAdd(args, io, deps)
  }
  if (command === 'dev') return dev(rest, io, deps)
  if (command === 'serve') return serve(rest, io)
  if (command === 'validate') return validate(rest, io)
  if (command === 'export') return exportHistory(rest, io)
  if (command === 'import') return importHistory(rest, io)
  if (command === 'doctor') return doctor(rest, io)
  if (command === 'bench') return bench(rest, io, deps.benchmark ?? runBenchmark)

  io.stderr(`Unknown command: ${command}`)
  io.stderr(USAGE)
  return 2
}
