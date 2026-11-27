import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { Sink, SwipeEvent } from '@swipeline/core'

const DEFAULT_TOLERANCE_SECONDS = 300

export interface WebhookSinkOptions {
  url: string
  /** HMAC-SHA256 key. The receiver needs the same secret. */
  secret: string
  /** Injected in tests; defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Millisecond clock, so tests can pin the signature timestamp. */
  now?: () => number
  /** Extra headers, for example a tenant or an API key. */
  headers?: Record<string, string>
}

export interface VerifyWebhookOptions {
  secret: string
  /** The `x-swipeline-signature` header value. */
  header: string
  /** The exact request body, as received. */
  body: string
  /** Millisecond clock; defaults to `Date.now`. */
  now?: () => number
  /** Accept this much clock skew in seconds. Defaults to 300. */
  toleranceSeconds?: number
}

/** The idempotency key for a batch: the same events always get the same id. */
export function deliveryId(events: readonly SwipeEvent[]): string {
  const ids = events
    .map((event) => event.id)
    .sort()
    .join(',')
  return createHash('sha256').update(ids).digest('hex').slice(0, 32)
}

/** `t=<unix seconds>,v1=<hex hmac of `t.body`>`, the Stripe-style scheme. */
export function signWebhook(secret: string, timestamp: number, body: string): string {
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${signature}`
}

/**
 * The receiver side of `webhookSink`: verify the signature in constant time and
 * reject anything outside the timestamp tolerance, so a captured request cannot
 * be replayed later.
 */
export function verifyWebhookSignature(options: VerifyWebhookOptions): boolean {
  const fields = new Map<string, string>()
  for (const part of options.header.split(',')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    fields.set(part.slice(0, separator).trim(), part.slice(separator + 1).trim())
  }

  const timestamp = Number(fields.get('t'))
  if (!Number.isFinite(timestamp)) return false

  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS
  const nowSeconds = Math.floor((options.now?.() ?? Date.now()) / 1000)
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false

  const expected = createHmac('sha256', options.secret)
    .update(`${timestamp}.${options.body}`)
    .digest()
  const received = Buffer.from(fields.get('v1') ?? '', 'hex')
  if (received.length !== expected.length) return false
  return timingSafeEqual(received, expected)
}

/**
 * POSTs each batch as JSON, signed with HMAC-SHA256 and tagged with a delivery
 * id derived from the event ids. A non-2xx response throws, which is how the
 * engine learns to retry; send the same `x-swipeline-delivery` value on that
 * retry and the receiver can dedupe it.
 */
export function webhookSink(options: WebhookSinkOptions): Sink {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const now = options.now ?? Date.now

  return {
    id: `webhook:${options.url}`,
    async deliver(events: readonly SwipeEvent[]): Promise<void> {
      if (events.length === 0) return
      const id = deliveryId(events)
      const body = JSON.stringify({ delivery: id, events })
      const timestamp = Math.floor(now() / 1000)
      const response = await fetchImpl(options.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-swipeline-delivery': id,
          'x-swipeline-signature': signWebhook(options.secret, timestamp, body),
          ...options.headers,
        },
        body,
      })
      if (!response.ok) {
        throw new Error(`webhook ${options.url} responded ${response.status}`)
      }
    },
  }
}

export interface JsonlFileSinkOptions {
  /** File to append to. Parent directories are created on first delivery. */
  path: string
}

/** Appends one JSON object per line, the format `swipeline validate` reads. */
export function jsonlFileSink(options: JsonlFileSinkOptions): Sink {
  return {
    id: `jsonl:${options.path}`,
    async deliver(events: readonly SwipeEvent[]): Promise<void> {
      if (events.length === 0) return
      await mkdir(dirname(options.path), { recursive: true })
      const lines = events.map((event) => JSON.stringify(event)).join('\n')
      await appendFile(options.path, `${lines}\n`, 'utf8')
    },
  }
}

export interface ConsoleSinkOptions {
  /** Defaults to `console.log`. */
  write?: (line: string) => void
}

/** One readable line per event, for local development. */
export function consoleSink(options: ConsoleSinkOptions = {}): Sink {
  const write = options.write ?? ((line: string) => console.log(line))
  return {
    id: 'console',
    async deliver(events: readonly SwipeEvent[]): Promise<void> {
      for (const event of events) {
        write(`[swipeline] ${event.actor} ${event.action} ${event.cardId} (${event.deckId})`)
      }
    },
  }
}
