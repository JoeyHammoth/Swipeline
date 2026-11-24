import type { Card } from '@swipeline/core'

export interface EmbedContext {
  signal?: AbortSignal
}

/** Turns text into vectors. Embedders are pure from the caller's perspective. */
export interface Embedder {
  readonly id: string
  readonly dimensions?: number
  embed(texts: readonly string[], ctx?: EmbedContext): Promise<Float32Array[]>
  embedCard(card: Card, ctx?: EmbedContext): Promise<Float32Array>
}

export interface TemplateOptions {
  /** Placeholders: `{title}`, `{subtitle}`, `{tags}`, `{body}`. */
  template?: string
  /** Prefix that identifies the model and template in a vector cache. */
  id?: string
  dimensions?: number
}

const DEFAULT_TEMPLATE = '{title}. {subtitle}. {tags}. {body}'

/** Renders the text an embedder sees, with empty placeholders collapsed away. */
export function cardText(card: Card, template: string = DEFAULT_TEMPLATE): string {
  const values: Record<string, string> = {
    title: card.title,
    subtitle: card.subtitle ?? '',
    tags: (card.tags ?? []).join(', '),
    body: card.body ?? '',
  }
  return template
    .replace(/\{(title|subtitle|tags|body)\}/g, (_, key: string) => values[key] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function asTextArray(texts: readonly string[]): string[] {
  return texts.map((text) => (typeof text === 'string' ? text : String(text)))
}

export class EmbeddingError extends Error {
  readonly status: number | undefined

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'EmbeddingError'
    this.status = status
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined
  const seconds = Number(header)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
  const date = Date.parse(header)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined
}

function vectorFrom(value: unknown): Float32Array | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const vector = new Float32Array(value.length)
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) return null
    vector[index] = entry
  }
  return vector
}

export interface OpenAiCompatibleOptions extends TemplateOptions {
  /** Base URL of the API, for example `http://localhost:11434/v1`. */
  baseUrl: string
  /** Optional: local OpenAI-compatible servers often need no key. */
  apiKey?: string | (() => string)
  model: string
  /** Texts per request. Defaults to 64. */
  batchSize?: number
  /** Injected for tests and hosts with a custom transport. */
  fetch?: typeof globalThis.fetch
  retry?: {
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
    sleep?: (ms: number) => Promise<void>
  }
}

interface OpenAiEmbeddingResponse {
  data?: unknown
  error?: { message?: string }
}

/**
 * Any OpenAI-compatible `/embeddings` endpoint: OpenAI itself, Ollama, LM Studio,
 * vLLM or an internal gateway. The key is read per request so a rotated secret
 * does not require rebuilding the embedder.
 */
export function openAiCompatibleEmbedder(options: OpenAiCompatibleOptions): Embedder {
  const fetchImpl = options.fetch ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') throw new TypeError('openAiCompatibleEmbedder needs fetch')
  const url = /\/embeddings\/?$/.test(options.baseUrl)
    ? options.baseUrl
    : `${options.baseUrl.replace(/\/+$/, '')}/embeddings`
  const batchSize = options.batchSize ?? 64
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError('batchSize must be a positive integer')
  }
  const maxRetries = options.retry?.maxRetries ?? 2
  const baseDelay = options.retry?.baseDelayMs ?? 250
  const maxDelay = options.retry?.maxDelayMs ?? 5_000
  const sleep = options.retry?.sleep ?? delay
  const template = options.template ?? DEFAULT_TEMPLATE

  async function embedBatch(
    texts: readonly string[],
    ctx: EmbedContext | undefined,
  ): Promise<Float32Array[]> {
    let attempt = 0
    for (;;) {
      if (ctx?.signal?.aborted) throw new EmbeddingError('embedding request aborted')
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        accept: 'application/json',
      }
      const key = typeof options.apiKey === 'function' ? options.apiKey() : options.apiKey
      if (key) headers.authorization = `Bearer ${key}`
      const init: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: options.model, input: texts }),
      }
      if (ctx?.signal) init.signal = ctx.signal

      let response: Response
      try {
        response = await fetchImpl(url, init)
      } catch (cause) {
        if (attempt >= maxRetries) {
          throw new EmbeddingError(cause instanceof Error ? cause.message : 'embedding failed')
        }
        attempt += 1
        await sleep(Math.min(maxDelay, baseDelay * 2 ** (attempt - 1)))
        continue
      }

      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const hinted = retryAfterMs(response.headers.get('retry-after'))
          attempt += 1
          await sleep(hinted ?? Math.min(maxDelay, baseDelay * 2 ** (attempt - 1)))
          continue
        }
        throw new EmbeddingError(`embedding endpoint responded ${response.status}`, response.status)
      }
      if (!response.ok) {
        throw new EmbeddingError(`embedding endpoint responded ${response.status}`, response.status)
      }

      let json: OpenAiEmbeddingResponse
      try {
        json = (await response.json()) as OpenAiEmbeddingResponse
      } catch {
        throw new EmbeddingError('embedding endpoint did not return JSON', response.status)
      }
      if (json.error?.message) throw new EmbeddingError(json.error.message, response.status)
      if (!Array.isArray(json.data)) {
        throw new EmbeddingError('embedding response has no data array', response.status)
      }
      const rows = json.data.map((entry) => {
        if (entry === null || typeof entry !== 'object') return null
        return vectorFrom((entry as { embedding?: unknown }).embedding)
      })
      if (rows.some((row) => row === null) || rows.length !== texts.length) {
        throw new EmbeddingError('embedding response has malformed vectors', response.status)
      }
      return rows as Float32Array[]
    }
  }

  return {
    id: options.id ?? `openai:${options.model}`,
    ...(options.dimensions === undefined ? {} : { dimensions: options.dimensions }),
    async embed(texts, ctx) {
      const input = asTextArray(texts)
      if (input.length === 0) return []
      const vectors: Float32Array[] = []
      for (let index = 0; index < input.length; index += batchSize) {
        vectors.push(...(await embedBatch(input.slice(index, index + batchSize), ctx)))
      }
      return vectors
    },
    async embedCard(card, ctx) {
      const [vector] = await this.embed([cardText(card, template)], ctx)
      if (!vector) throw new EmbeddingError('embedder returned no vector for a card')
      return vector
    },
  }
}

type TransformersExtractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: true },
) => Promise<{
  tolist(): unknown
}>

export interface TransformersModule {
  pipeline(
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ): Promise<TransformersExtractor>
}

export interface TransformersOptions extends TemplateOptions {
  /** Hugging Face model id, for example `Xenova/all-MiniLM-L6-v2`. */
  model: string
  device?: 'auto' | 'cpu' | 'webgpu' | 'wasm'
  /** Injected in tests so no model is downloaded. */
  loader?: () => Promise<TransformersModule>
  /** Texts per extractor call. Defaults to 32. */
  batchSize?: number
}

/**
 * Local embeddings through Transformers.js. The dependency is optional and
 * loaded lazily, so importing `@swipeline/embed` never downloads a model and
 * server bundles that do not use this function stay small.
 */
export function transformersEmbedder(options: TransformersOptions): Embedder {
  const batchSize = options.batchSize ?? 32
  const template = options.template ?? DEFAULT_TEMPLATE
  let extractorPromise: Promise<TransformersExtractor> | undefined

  async function load(): Promise<TransformersExtractor> {
    if (!extractorPromise) {
      extractorPromise = (async () => {
        const loader =
          options.loader ??
          (async (): Promise<TransformersModule> => {
            const specifier: string = '@huggingface/transformers'
            return (await import(/* @vite-ignore */ specifier)) as TransformersModule
          })
        const module = await loader()
        const settings: Record<string, unknown> = { pooling: 'mean', normalize: true }
        if (options.device) settings.device = options.device
        return module.pipeline('feature-extraction', options.model, settings)
      })()
    }
    return extractorPromise
  }

  async function embedBatch(texts: readonly string[]): Promise<Float32Array[]> {
    const extractor = await load()
    const output = await extractor(asTextArray(texts), { pooling: 'mean', normalize: true })
    const rows = output.tolist()
    if (!Array.isArray(rows)) throw new EmbeddingError('Transformers.js returned no rows')
    return rows.map((row) => {
      const vector = vectorFrom(row)
      if (!vector) throw new EmbeddingError('Transformers.js returned a malformed vector')
      return vector
    })
  }

  return {
    id: options.id ?? `transformers:${options.model}`,
    ...(options.dimensions === undefined ? {} : { dimensions: options.dimensions }),
    async embed(texts) {
      const input = asTextArray(texts)
      const vectors: Float32Array[] = []
      for (let index = 0; index < input.length; index += batchSize) {
        vectors.push(...(await embedBatch(input.slice(index, index + batchSize))))
      }
      return vectors
    },
    async embedCard(card) {
      const [vector] = await this.embed([cardText(card, template)])
      if (!vector) throw new EmbeddingError('embedder returned no vector for a card')
      return vector
    },
  }
}
