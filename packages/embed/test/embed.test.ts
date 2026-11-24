import { describe, expect, it, vi } from 'vitest'
import {
  cardText,
  EmbeddingError,
  openAiCompatibleEmbedder,
  transformersEmbedder,
} from '../src/index.js'

const card = {
  schemaVersion: 1 as const,
  id: 'books:1',
  sourceId: 'books',
  title: 'Project Hail Mary',
  subtitle: 'Andy Weir',
  tags: ['science fiction', 'space'],
  fetchedAt: '2026-11-24T00:00:00.000Z',
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

describe('cardText', () => {
  it('renders placeholders and collapses empty ones', () => {
    expect(cardText(card, '{title} by {subtitle}. {body}')).toBe('Project Hail Mary by Andy Weir.')
  })

  it('falls back to the default template', () => {
    expect(cardText(card)).toContain('Project Hail Mary')
    expect(cardText(card)).toContain('science fiction, space')
  })
})

describe('openAiCompatibleEmbedder', () => {
  it('batches, sends the model and reads the key per request', async () => {
    let key = 'first'
    const requests: Array<{ body: unknown; auth: string | null }> = []
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: string[] }
      requests.push({
        body,
        auth: new Headers(init?.headers).get('authorization'),
      })
      return jsonResponse({
        data: body.input.map((_text, index) => ({ embedding: [index + 1, 0.5], index })),
      })
    })
    key = 'rotated'
    const embedder = openAiCompatibleEmbedder({
      baseUrl: 'https://example.test/v1/',
      apiKey: () => key,
      model: 'text-embedding-3-small',
      batchSize: 2,
      fetch: fetch as unknown as typeof globalThis.fetch,
    })

    const vectors = await embedder.embed(['a', 'b', 'c'])
    expect(vectors).toHaveLength(3)
    expect(vectors[0]).toBeInstanceOf(Float32Array)
    expect(requests).toHaveLength(2)
    expect(requests[0]?.body).toEqual({ model: 'text-embedding-3-small', input: ['a', 'b'] })
    expect(requests[0]?.auth).toBe('Bearer rotated')
    expect(embedder.id).toBe('openai:text-embedding-3-small')
  })

  it('retries 429 with Retry-After without waiting', async () => {
    const sleep = vi.fn(async () => {})
    let calls = 0
    const fetch = vi.fn(async () => {
      calls += 1
      if (calls === 1) {
        return jsonResponse(
          { error: { message: 'slow down' } },
          { status: 429, headers: { 'retry-after': '2' } },
        )
      }
      return jsonResponse({ data: [{ embedding: [1, 0, 0], index: 0 }] })
    })
    const embedder = openAiCompatibleEmbedder({
      baseUrl: 'https://example.test/v1',
      model: 'm',
      fetch: fetch as unknown as typeof globalThis.fetch,
      retry: { sleep },
    })

    const [vector] = await embedder.embed(['a'])
    expect(Array.from(vector ?? [])).toEqual([1, 0, 0])
    expect(sleep).toHaveBeenCalledWith(2000)
  })

  it('rejects malformed vectors instead of returning holes', async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({ data: [{ embedding: ['not-a-number'], index: 0 }] }),
    )
    const embedder = openAiCompatibleEmbedder({
      baseUrl: 'https://example.test/v1',
      model: 'm',
      fetch: fetch as unknown as typeof globalThis.fetch,
    })
    await expect(embedder.embed(['a'])).rejects.toBeInstanceOf(EmbeddingError)
  })

  it('embeds a card through the template', async () => {
    const fetch = vi.fn(async () => jsonResponse({ data: [{ embedding: [0.1, 0.2], index: 0 }] }))
    const embedder = openAiCompatibleEmbedder({
      baseUrl: 'https://example.test/v1',
      model: 'm',
      template: '{title}',
      fetch: fetch as unknown as typeof globalThis.fetch,
    })
    const vector = await embedder.embedCard(card)
    expect(Array.from(vector)).toEqual([expect.closeTo(0.1), expect.closeTo(0.2)])
  })
})

describe('transformersEmbedder', () => {
  it('loads the model lazily and maps rows to Float32Arrays', async () => {
    const calls: string[][] = []
    const pipeline = vi.fn(async () => async (texts: string[]) => {
      calls.push(texts)
      return { tolist: () => texts.map(() => [0.25, 0.75]) }
    })
    const loader = vi.fn(async () => ({ pipeline }))
    const embedder = transformersEmbedder({ model: 'Xenova/all-MiniLM-L6-v2', loader })

    expect(loader).not.toHaveBeenCalled()
    const [vector] = await embedder.embed(['hello'])
    expect(loader).toHaveBeenCalledOnce()
    expect(calls).toEqual([['hello']])
    expect(Array.from(vector ?? [])).toEqual([0.25, 0.75])
    expect(embedder.id).toBe('transformers:Xenova/all-MiniLM-L6-v2')
  })
})
