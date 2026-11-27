import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BenchMetrics, BenchReport, StrategyName } from '@swipeline/bench'
import { createUlid, type SwipeEvent } from '@swipeline/core'
import { createSqliteStores } from '@swipeline/store-sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { createDevServer } from '../src/dev.js'
import { type CliIo, parseServeOptions, run, USAGE, validateHistoryFile } from '../src/index.js'
import { CONFIG_FILE, initDeck, loadManifest } from '../src/init.js'

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
    const code = await run(['bench', '--k', '4'], captured.io, {
      benchmark: async (options) => {
        expect(options.k).toBe(4)
        return report(0.6)
      },
    })
    expect(code).toBe(0)
    expect(captured.out[0]).toContain('precision@k')
    expect(captured.out.some((line) => line.startsWith('default'))).toBe(true)
  })

  it('exits 3 when the default pipeline does not beat the baselines', async () => {
    const captured = capture()
    const code = await run(['bench', '--gate'], captured.io, { benchmark: async () => report(0.2) })
    expect(code).toBe(3)
    expect(captured.err[0]).toContain('did not beat the best baseline')
  })

  it('exits 0 with --gate when the default pipeline wins', async () => {
    const captured = capture()
    const code = await run(['bench', '--gate'], captured.io, { benchmark: async () => report(0.9) })
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

describe('swipeline init', () => {
  it('writes a manifest for the chosen template', async () => {
    const root = await workspace()
    const captured = capture()
    expect(await run(['init', root, '--template', 'books'], captured.io)).toBe(0)

    expect(captured.out[0]).toContain(CONFIG_FILE)
    const manifest = await loadManifest(join(root, CONFIG_FILE))
    expect(manifest.id).toBe('books')
    expect(manifest.source.id).toBe('openlibrary')
    expect(manifest.source.pagination?.type).toBe('page')
    expect(captured.out.some((line) => line.includes('swipeline dev'))).toBe(true)
  })

  it('detects the framework from package.json', async () => {
    const root = await workspace()
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ dependencies: { react: '^19.0.0' } }),
      'utf8',
    )
    const captured = capture()
    expect(await run(['init', root, '--template', 'blank'], captured.io)).toBe(0)
    expect(captured.out[1]).toContain('react')
    expect(captured.out.some((line) => line.includes('@swipeline/react'))).toBe(true)
  })

  it('refuses to overwrite and accepts --force', async () => {
    const root = await workspace()
    const first = capture()
    expect(await run(['init', root, '--template', 'books'], first.io)).toBe(0)

    const second = capture()
    expect(await run(['init', root, '--template', 'products'], second.io)).toBe(1)
    expect(second.err[0]).toContain('--force')

    const forced = capture()
    expect(await run(['init', root, '--template', 'products', '--force'], forced.io)).toBe(0)
    expect((await loadManifest(join(root, CONFIG_FILE))).id).toBe('products')
  })

  it('rejects an unknown template', async () => {
    const root = await workspace()
    const captured = capture()
    expect(await run(['init', root, '--template', 'podcasts'], captured.io)).toBe(2)
    expect(captured.err[0]).toContain('Unknown template: podcasts')
  })
})

describe('swipeline source add', () => {
  function jsonResponse(body: unknown): typeof fetch {
    return async () => new Response(JSON.stringify(body), { status: 200 })
  }

  it('infers a mapping from a sample and previews cards', async () => {
    const root = await workspace()
    const config = join(root, CONFIG_FILE)
    const captured = capture()
    const code = await run(
      ['source', 'add', 'https://api.example.com/things', '--config', config],
      captured.io,
      {
        fetch: jsonResponse({
          results: [
            { id: 'a1', name: 'Alpha', description: 'First', tags: ['one', 'two'] },
            { id: 'a2', name: 'Beta', description: 'Second' },
          ],
        }),
      },
    )

    expect(code).toBe(0)
    expect(captured.out.some((line) => line.includes('itemsPath: results'))).toBe(true)
    expect(captured.out).toContain('  preview: Alpha — First')

    const manifest = await loadManifest(config)
    expect(manifest.source.itemsPath).toBe('results')
    expect(manifest.source.map).toEqual({
      id: 'id',
      title: 'name',
      subtitle: 'description',
      tags: 'tags[:8]',
    })
    expect(manifest.id).toBe('api-example')
  })

  it('finds a nested array and keeps an existing deck id', async () => {
    const root = await workspace()
    const config = join(root, CONFIG_FILE)
    await writeFile(
      config,
      JSON.stringify({
        id: 'books',
        actor: 'local',
        source: {
          type: 'http-json',
          id: 'x',
          url: 'https://x.test/?page=1',
          map: { id: 'a', title: 'b' },
        },
      }),
      'utf8',
    )

    const captured = capture()
    expect(
      await run(
        ['source', 'add', 'https://api.crossref.org/works', '--config', config, '--id', 'crossref'],
        captured.io,
        {
          fetch: jsonResponse({ message: { items: [{ DOI: '10.1/x', title: ['Paper'] }] } }),
        },
      ),
    ).toBe(0)

    const manifest = await loadManifest(config)
    expect(manifest.id).toBe('books')
    expect(manifest.source.id).toBe('crossref')
    expect(manifest.source.itemsPath).toBe('message.items')
  })

  it('fails with a readable message when nothing maps', async () => {
    const root = await workspace()
    const captured = capture()
    const code = await run(
      ['source', 'add', 'https://api.example.com/x', '--config', join(root, CONFIG_FILE)],
      captured.io,
      {
        fetch: jsonResponse({ error: 'nope' }),
      },
    )
    expect(code).toBe(1)
    expect(captured.err[0]).toContain('Could not map https://api.example.com/x')
    expect(captured.err[0]).toContain('no array of objects')
  })

  it('exits 2 without a URL', async () => {
    const captured = capture()
    expect(await run(['source', 'add'], captured.io)).toBe(2)
    expect(captured.err).toEqual(['source add needs exactly one URL'])
  })
})

describe('swipeline dev', () => {
  function sourceResponse(): typeof fetch {
    return async () =>
      new Response(
        JSON.stringify({
          docs: [
            { key: '/works/OL1W', title: 'Dune', author_name: ['Herbert'] },
            { key: '/works/OL2W', title: 'Emma', author_name: ['Austen'] },
            { key: '/works/OL3W', title: 'Ulysses', author_name: ['Joyce'] },
          ],
        }),
        { status: 200 },
      )
  }

  it('serves the playground and records swipes through the real routes', async () => {
    const root = await workspace()
    const manifest = await initDeck({ directory: root, template: 'books' })
    const stores = createSqliteStores({ path: ':memory:' })
    const dev = await createDevServer({
      manifest: manifest.manifest,
      stores,
      port: 0,
      fetch: sourceResponse(),
    })

    try {
      expect(dev.cards).toHaveLength(3)

      const page = await fetch(`${dev.url}/`)
      expect(page.status).toBe(200)
      const html = await page.text()
      expect(html).toContain('books deck')
      expect(html).toContain('actor local')

      const next = await fetch(`${dev.url}/api/deck/books/next?actor=local&limit=3`)
      expect(next.status).toBe(200)
      const body = (await next.json()) as { cards: { id: string }[] }
      expect(body.cards).toHaveLength(3)

      const swiped = body.cards[0]?.id ?? ''
      const swipe = await fetch(`${dev.url}/dev/swipe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cardId: swiped, action: 'like' }),
      })
      expect(swipe.status).toBe(202)

      const after = (await (
        await fetch(`${dev.url}/api/deck/books/next?actor=local&limit=3`)
      ).json()) as {
        cards: { id: string }[]
      }
      expect(after.cards.map((card) => card.id)).not.toContain(swiped)
      expect(after.cards).toHaveLength(2)

      const events = await stores.events.query({ actor: 'local' })
      expect(events).toHaveLength(1)
      expect(events[0]?.action).toBe('like')
    } finally {
      await dev.close()
      stores.close()
    }
  })

  it('rejects a swipe without a card id', async () => {
    const root = await workspace()
    const manifest = await initDeck({ directory: root, template: 'books' })
    const stores = createSqliteStores({ path: ':memory:' })
    const dev = await createDevServer({
      manifest: manifest.manifest,
      stores,
      port: 0,
      fetch: sourceResponse(),
    })
    try {
      const response = await fetch(`${dev.url}/dev/swipe`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'like' }),
      })
      expect(response.status).toBe(400)
    } finally {
      await dev.close()
      stores.close()
    }
  })

  it('reports a missing manifest instead of crashing', async () => {
    const root = await workspace()
    const captured = capture()
    const code = await run(['dev', '--config', join(root, CONFIG_FILE)], captured.io)
    expect(code).toBe(1)
    expect(captured.err[0]).toContain('Run swipeline init first')
  })
})
