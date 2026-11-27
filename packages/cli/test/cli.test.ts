import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BenchMetrics, BenchReport, StrategyName } from '@swipeline/bench'
import { createUlid, type SwipeEvent } from '@swipeline/core'
import { createSqliteStores } from '@swipeline/store-sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { type CliIo, parseServeOptions, run, USAGE, validateHistoryFile } from '../src/index.js'

let directory: string | undefined

async function workspace(): Promise<string> {
  directory = await mkdtemp(join(tmpdir(), 'swipeline-cli-'))
  return directory
}

function event(overrides: Partial<SwipeEvent> = {}): SwipeEvent {
  return {
    schemaVersion: 1,
    id: createUlid(),
    deckId: 'books',
    cardId: 'books:1',
    actor: 'reader',
    action: 'like',
    position: 0,
    ts: new Date().toISOString(),
    ...overrides,
  }
}

async function historyFile(lines: string[]): Promise<string> {
  const root = directory ?? (await workspace())
  const path = join(root, 'history.jsonl')
  await writeFile(path, `${lines.join('\n')}\n`, 'utf8')
  return path
}

async function seededDatabase(events: readonly SwipeEvent[]): Promise<string> {
  const root = directory ?? (await workspace())
  const path = join(root, 'swipes.db')
  const stores = createSqliteStores({ path })
  await stores.events.append(events)
  stores.close()
  return path
}

function capture(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = []
  const err: string[] = []
  return { io: { stdout: (line) => out.push(line), stderr: (line) => err.push(line) }, out, err }
}

function metrics(overrides: Partial<BenchMetrics> = {}): BenchMetrics {
  return {
    precisionAtK: 0.5,
    timeToFirstLike: 2,
    regret: 0.1,
    diversity: 0.4,
    coverage: 0.3,
    exploration: 0.2,
    picks: 10,
    likes: 5,
    ...overrides,
  }
}

function report(defaultPrecision: number, baseline = 0.3): BenchReport {
  const strategies: Record<StrategyName, BenchMetrics> = {
    default: metrics({ precisionAtK: defaultPrecision }),
    random: metrics({ precisionAtK: baseline }),
    popularity: metrics({ precisionAtK: baseline - 0.1 }),
    tagOnly: metrics({ precisionAtK: baseline - 0.05 }),
  }
  return { seed: 1, users: 2, cards: 10, k: 4, strategies }
}

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true })
  directory = undefined
})

describe('swiline serve options', () => {
  it('defaults to 127.0.0.1:8787 with no database', () => {
    expect(parseServeOptions([])).toEqual({
      ok: true,
      options: { port: 8787, host: '127.0.0.1', cors: [] },
    })
  })

  it('reads port, host, repeated cors origins and --db', () => {
    expect(
      parseServeOptions([
        '--port',
        '9000',
        '--host',
        '0.0.0.0',
        '--cors',
        'https://a.example',
        '--cors',
        'https://b.example',
        '--db',
        './swipes.db',
      ]),
    ).toEqual({
      ok: true,
      options: {
        port: 9000,
        host: '0.0.0.0',
        cors: ['https://a.example', 'https://b.example'],
        db: './swipes.db',
      },
    })
  })

  it('rejects a bad port, an unknown option and a stray argument', () => {
    expect(parseServeOptions(['--port', 'eighty'])).toEqual({
      ok: false,
      message: '--port needs a number',
    })
    expect(parseServeOptions(['--port', '70000'])).toEqual({
      ok: false,
      message: '--port must be 65535 or lower',
    })
    expect(parseServeOptions(['--wat'])).toEqual({
      ok: false,
      message: 'Unknown option: --wat',
    })
    expect(parseServeOptions(['extra'])).toEqual({
      ok: false,
      message: 'Unexpected argument: extra',
    })
  })
})

describe('swipeline validate', () => {
  it('accepts a history with blank lines', async () => {
    await workspace()
    const path = await historyFile([JSON.stringify(event()), '', JSON.stringify(event())])
    const result = await validateHistoryFile(path)
    expect(result.errors).toEqual([])
    expect(result.events).toHaveLength(2)
    expect(result.events[0]?.actor).toBe('reader')
  })

  it('reports the line number of an invalid event', async () => {
    await workspace()
    const path = await historyFile([
      JSON.stringify(event()),
      JSON.stringify({ ...event(), id: 'not-a-ulid' }),
    ])
    const result = await validateHistoryFile(path)
    expect(result.events).toHaveLength(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.line).toBe(2)
    expect(result.errors[0]?.message).toContain('ULID')
  })

  it('exits 0 for a valid file and 1 for an invalid one', async () => {
    await workspace()
    const good = await historyFile([JSON.stringify(event())])
    const goodRun = capture()
    expect(await run(['validate', good], goodRun.io)).toBe(0)
    expect(goodRun.out).toEqual(['1 event(s) valid.'])

    const bad = await historyFile(['{"id":"nope"}'])
    const badRun = capture()
    expect(await run(['validate', bad], badRun.io)).toBe(1)
    expect(badRun.err.some((line) => line.startsWith('line 1: '))).toBe(true)
  })

  it('exits 2 without a file', async () => {
    const captured = capture()
    expect(await run(['validate'], captured.io)).toBe(2)
    expect(captured.err).toEqual(['validate needs exactly one JSONL file'])
  })
})

describe('swipeline export', () => {
  it('writes JSONL to stdout and the summary to stderr', async () => {
    await workspace()
    const first = event({ cardId: 'books:1' })
    const second = event({ cardId: 'books:2', position: 1 })
    const path = await seededDatabase([first, second])

    const captured = capture()
    expect(await run(['export', path], captured.io)).toBe(0)

    // Events come back in ULID order, which two ids created in the same
    // millisecond do not necessarily share with insertion order.
    expect(captured.out.map((line) => (JSON.parse(line) as SwipeEvent).cardId).sort()).toEqual([
      'books:1',
      'books:2',
    ])
    expect(captured.err).toEqual(['2 event(s) exported.'])
  })

  it('filters by actor and writes to --out', async () => {
    await workspace()
    const path = await seededDatabase([event(), event({ actor: 'someone-else' })])
    const out = join(directory ?? '', 'out.jsonl')

    const captured = capture()
    expect(await run(['export', path, '--actor', 'someone-else', '--out', out], captured.io)).toBe(
      0,
    )

    expect(captured.out).toEqual([`1 event(s) written to ${out}.`])
    const stores = createSqliteStores({ path })
    stores.close()
    const written = await (await import('node:fs/promises')).readFile(out, 'utf8')
    expect(written.trim().split('\n')).toHaveLength(1)
    expect((JSON.parse(written.trim()) as SwipeEvent).actor).toBe('someone-else')
  })

  it('fails on a missing database and on bad usage', async () => {
    await workspace()
    const missing = capture()
    expect(await run(['export', join(directory ?? '', 'nope.db')], missing.io)).toBe(1)
    expect(missing.err[0]).toMatch(/^No such database: /)

    const usage = capture()
    expect(await run(['export'], usage.io)).toBe(2)
    expect(usage.err).toEqual(['export needs exactly one SQLite database'])
  })
})

describe('swipeline import', () => {
  it('appends a JSONL history and reports only the new events', async () => {
    await workspace()
    const path = await historyFile([JSON.stringify(event()), JSON.stringify(event())])

    const first = capture()
    expect(await run(['import', join(directory ?? '', 'swipes.db'), path], first.io)).toBe(0)
    expect(first.out[0]).toContain('2 new event(s)')

    const second = capture()
    expect(await run(['import', join(directory ?? '', 'swipes.db'), path], second.io)).toBe(0)
    expect(second.out[0]).toContain('0 new event(s)')
    expect(second.out[0]).toContain('2 total')
  })

  it('imports nothing when a line is invalid', async () => {
    await workspace()
    const path = await historyFile([JSON.stringify(event()), '{"id":"nope"}'])
    const db = join(directory ?? '', 'swipes.db')

    const captured = capture()
    expect(await run(['import', db, path], captured.io)).toBe(1)
    expect(captured.err.some((line) => line.includes('nothing imported'))).toBe(true)
    expect(existsSync(db)).toBe(false)
  })

  it('exits 2 without both arguments', async () => {
    const captured = capture()
    expect(await run(['import', 'swipes.db'], captured.io)).toBe(2)
    expect(captured.err).toEqual(['import needs a SQLite database and one JSONL file'])
  })
})

describe('swipeline doctor', () => {
  it('reports the runtime and an absent database', async () => {
    const captured = capture()
    expect(await run(['doctor'], captured.io)).toBe(0)
    expect(captured.out[0]).toMatch(/^swipeline /)
    expect(captured.out[1]).toContain(process.version)
    expect(captured.out.some((line) => line.startsWith('database: none'))).toBe(true)
  })

  it('reports the rows in an existing database', async () => {
    await workspace()
    const path = await seededDatabase([event(), event()])

    const captured = capture()
    expect(await run(['doctor', '--db', path], captured.io)).toBe(0)
    expect(captured.out.some((line) => line.includes('schema 1, 2 event(s)'))).toBe(true)
  })

  it('rejects an unknown option', async () => {
    const captured = capture()
    expect(await run(['doctor', '--wat'], captured.io)).toBe(2)
    expect(captured.err[0]).toBe('Unknown option: --wat')
  })
})

describe('swipeline bench', () => {
  it('prints the strategy table and exits 0', async () => {
    const captured = capture()
    const code = await run(['bench', '--k', '4'], captured.io, async (options) => {
      expect(options.k).toBe(4)
      return report(0.6)
    })
    expect(code).toBe(0)
    expect(captured.out[0]).toContain('precision@k')
    expect(captured.out.some((line) => line.startsWith('default'))).toBe(true)
  })

  it('exits 3 when the default pipeline does not beat the baselines', async () => {
    const captured = capture()
    const code = await run(['bench', '--gate'], captured.io, async () => report(0.2))
    expect(code).toBe(3)
    expect(captured.err[0]).toContain('did not beat the best baseline')
  })

  it('exits 0 with --gate when the default pipeline wins', async () => {
    const captured = capture()
    const code = await run(['bench', '--gate'], captured.io, async () => report(0.9))
    expect(code).toBe(0)
    expect(captured.err[0]).toContain('beats the best baseline')
  })
})

describe('swipeline help', () => {
  it('prints usage and exits 0', async () => {
    const captured = capture()
    expect(await run(['help'], captured.io)).toBe(0)
    expect(captured.out).toEqual([USAGE])
  })

  it('exits 2 for an unknown command', async () => {
    const captured = capture()
    expect(await run(['frobnicate'], captured.io)).toBe(2)
    expect(captured.err[0]).toBe('Unknown command: frobnicate')
  })
})
