import { mkdtemp, readFile, rm } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createUlid, type SwipeEvent } from '@swipeline/core'
import { afterEach, describe, expect, it } from 'vitest'
import {
  consoleSink,
  deliveryId,
  jsonlFileSink,
  signWebhook,
  verifyWebhookSignature,
  webhookSink,
} from '../src/index.js'

let cleanup: (() => Promise<void>) | undefined

afterEach(async () => {
  await cleanup?.()
  cleanup = undefined
})

function event(index: number, overrides: Partial<SwipeEvent> = {}): SwipeEvent {
  return {
    schemaVersion: 1,
    id: createUlid(),
    deckId: 'books',
    cardId: `books:${index}`,
    actor: 'reader',
    action: 'like',
    position: index,
    ts: new Date(Date.UTC(2026, 10, 24, 12, 0, index)).toISOString(),
    ...overrides,
  }
}

interface Capture {
  headers: IncomingMessage['headers']
  body: string
}

function receiver(
  status = 200,
): Promise<{ url: string; captured: Capture[]; close(): Promise<void> }> {
  const captured: Capture[] = []
  return new Promise((resolve) => {
    const server = createServer((request, response) => {
      const chunks: Buffer[] = []
      request.on('data', (chunk: Buffer) => chunks.push(chunk))
      request.on('end', () => {
        captured.push({ headers: request.headers, body: Buffer.concat(chunks).toString('utf8') })
        response.writeHead(status).end('ok')
      })
    })
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      resolve({
        url: `http://127.0.0.1:${port}/swipes`,
        captured,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections()
            server.close(() => done())
          }),
      })
    })
  })
}

describe('webhook sink', () => {
  it('signs each batch so the receiver can verify it', async () => {
    const target = await receiver()
    cleanup = target.close
    const sink = webhookSink({
      url: target.url,
      secret: 's3cret',
      now: () => Date.UTC(2026, 10, 24, 12),
    })

    await sink.deliver([event(0), event(1)])

    const [captured] = target.captured
    expect(captured).toBeDefined()
    const header = String(captured?.headers['x-swipeline-signature'])
    expect(
      verifyWebhookSignature({
        secret: 's3cret',
        header,
        body: captured?.body ?? '',
        now: () => Date.UTC(2026, 10, 24, 12),
      }),
    ).toBe(true)
    expect(
      verifyWebhookSignature({
        secret: 'wrong',
        header,
        body: captured?.body ?? '',
        now: () => Date.UTC(2026, 10, 24, 12),
      }),
    ).toBe(false)
  })

  it('rejects a stale signature and a tampered body', () => {
    const body = JSON.stringify({ events: [event(0)] })
    const timestamp = Math.floor(Date.UTC(2026, 10, 24, 12) / 1000)
    const header = signWebhook('s3cret', timestamp, body)
    const clock = () => Date.UTC(2026, 10, 24, 12)

    expect(verifyWebhookSignature({ secret: 's3cret', header, body, now: clock })).toBe(true)
    expect(verifyWebhookSignature({ secret: 's3cret', header, body: `${body} `, now: clock })).toBe(
      false,
    )
    expect(
      verifyWebhookSignature({
        secret: 's3cret',
        header,
        body,
        now: () => Date.UTC(2026, 10, 24, 18),
      }),
    ).toBe(false)
  })

  it('keeps the delivery id stable for the same events', async () => {
    const target = await receiver()
    cleanup = target.close
    const sink = webhookSink({ url: target.url, secret: 's3cret' })
    const batch = [event(0), event(1)]

    await sink.deliver(batch)
    await sink.deliver([...batch].reverse())

    expect(deliveryId(batch)).toBe(deliveryId([...batch].reverse()))
    const ids = target.captured.map((entry) => entry.headers['x-swipeline-delivery'])
    expect(ids[0]).toBe(ids[1])
    expect(target.captured[0]?.body).toContain('"delivery"')
  })

  it('throws on a non-2xx response so the engine can retry', async () => {
    const target = await receiver(503)
    cleanup = target.close
    const sink = webhookSink({ url: target.url, secret: 's3cret' })
    await expect(sink.deliver([event(0)])).rejects.toThrow(/responded 503/)
  })

  it('does not call the network for an empty batch', async () => {
    const target = await receiver()
    cleanup = target.close
    const sink = webhookSink({ url: target.url, secret: 's3cret' })
    await sink.deliver([])
    expect(target.captured).toEqual([])
  })
})

describe('jsonl file sink', () => {
  it('appends one line per event and creates the directory', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'swipeline-sinks-'))
    cleanup = () => rm(directory, { recursive: true, force: true })
    const path = join(directory, 'nested', 'history.jsonl')
    const sink = jsonlFileSink({ path })

    await sink.deliver([event(0), event(1)])
    await sink.deliver([event(2)])

    const text = await readFile(path, 'utf8')
    const lines = text.trim().split('\n')
    expect(lines).toHaveLength(3)
    expect(lines.map((line) => (JSON.parse(line) as SwipeEvent).cardId)).toEqual([
      'books:0',
      'books:1',
      'books:2',
    ])
  })

  it('writes nothing for an empty batch', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'swipeline-sinks-'))
    cleanup = () => rm(directory, { recursive: true, force: true })
    const path = join(directory, 'history.jsonl')
    await jsonlFileSink({ path }).deliver([])
    await expect(readFile(path, 'utf8')).rejects.toThrow()
  })
})

describe('console sink', () => {
  it('writes one readable line per event', async () => {
    const lines: string[] = []
    await consoleSink({ write: (line) => lines.push(line) }).deliver([
      event(0),
      event(1, { action: 'dislike', actor: 'someone' }),
    ])
    expect(lines).toEqual([
      '[swipeline] reader like books:0 (books)',
      '[swipeline] someone dislike books:1 (books)',
    ])
  })
})
