import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { createHttpJsonAdapter, httpJsonSourceConfig } from '@swipeline/adapter-http-json'
import {
  type Card,
  createUlid,
  type DeckManifest,
  type EventStore,
  type ItemStore,
  parseSwipeEvent,
} from '@swipeline/core'
import { createServer } from '@swipeline/server'

export interface DevOptions {
  manifest: DeckManifest
  stores: { events: EventStore; items: ItemStore }
  /** Local actor the playground swipes as. Defaults to the manifest's actor. */
  actor?: string
  port?: number
  host?: string
  /** Injected in tests; defaults to the global `fetch`. */
  fetch?: typeof globalThis.fetch
}

export interface DevServer {
  url: string
  port: number
  /** Cards loaded from the source, so a caller can report the count. */
  cards: readonly Card[]
  close(): Promise<void>
}

const ACTIONS = ['like', 'dislike', 'superlike', 'later'] as const

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function previewHtml(manifest: DeckManifest, actor: string): string {
  const title = escapeHtml(manifest.id)
  const who = escapeHtml(actor)
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · swipeline dev</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 2rem; display: grid; gap: 1rem; justify-items: center; }
  h1 { font-size: 1rem; font-weight: 600; opacity: 0.7; margin: 0; }
  .card { min-width: 20rem; max-width: 32rem; border: 1px solid currentColor; border-radius: 14px; padding: 1.25rem; }
  .card h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
  .card p { margin: 0.25rem 0; opacity: 0.8; }
  .tags { list-style: none; display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0; margin: 0.75rem 0 0; }
  .tags li { font-size: 0.75rem; border: 1px solid currentColor; border-radius: 999px; padding: 0.1rem 0.5rem; opacity: 0.7; }
  .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
  button { font: inherit; padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid currentColor; background: transparent; cursor: pointer; }
  button:hover { background: rgba(127,127,127,0.15); }
  .meta { font-size: 0.8rem; opacity: 0.6; }
  @media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
</head>
<body>
  <h1>${title} deck · actor ${who}</h1>
  <div class="card" id="card" aria-live="polite"><h2>Loading…</h2></div>
  <div class="actions" role="group" aria-label="Swipe">
    <button type="button" data-action="dislike">Dislike (←)</button>
    <button type="button" data-action="later">Later (↓)</button>
    <button type="button" data-action="like">Like (→)</button>
    <button type="button" data-action="superlike">Superlike (↑)</button>
  </div>
  <p class="meta" id="meta">Ranked by the default pipeline through the real server routes.</p>
<script>
  const deckId = ${JSON.stringify(manifest.id)}
  const actor = ${JSON.stringify(actor)}
  const card = document.getElementById('card')
  const meta = document.getElementById('meta')
  let current = null

  function render(next) {
    current = next
    if (!next) {
      card.innerHTML = '<h2>Deck exhausted</h2><p>Swipe again after adding more cards.</p>'
      return
    }
    const tags = (next.tags || []).slice(0, 8).map((tag) => '<li>' + tag.replace(/[&<>"]/g, '') + '</li>').join('')
    card.innerHTML =
      '<h2>' + (next.title || '') + '</h2>' +
      (next.subtitle ? '<p>' + next.subtitle + '</p>' : '') +
      (tags ? '<ul class="tags">' + tags + '</ul>' : '')
  }

  async function load() {
    const response = await fetch('/api/deck/' + encodeURIComponent(deckId) + '/next?actor=' + encodeURIComponent(actor) + '&limit=1')
    const body = await response.json()
    render(body.cards && body.cards[0])
  }

  async function swipe(action) {
    if (!current) return
    const response = await fetch('/dev/swipe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cardId: current.id, action })
    })
    if (!response.ok) {
      meta.textContent = 'Could not record that swipe: ' + response.status
      return
    }
    await load()
  }

  for (const button of document.querySelectorAll('button[data-action]')) {
    button.addEventListener('click', () => swipe(button.dataset.action))
  }
  document.addEventListener('keydown', (event) => {
    const map = { ArrowRight: 'like', ArrowLeft: 'dislike', ArrowUp: 'superlike', ArrowDown: 'later' }
    const action = map[event.key]
    if (!action) return
    event.preventDefault()
    void swipe(action)
  })

  void load()
</script>
</body>
</html>
`
}

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      if (text.trim() === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch {
        reject(new SyntaxError('body must be JSON'))
      }
    })
    request.on('error', reject)
  })
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

/**
 * The `swipeline dev` server: it fetches one page from the deck's source, loads
 * the cards into the item store, and serves a playground on the same port as the
 * real API. `/api/*` is the documented server surface; `/dev/swipe` is a
 * dev-only shortcut that records a swipe with a generated ULID and position.
 */
export async function createDevServer(options: DevOptions): Promise<DevServer> {
  const { manifest, stores } = options
  const actor = options.actor ?? manifest.actor ?? 'local'
  const adapter = createHttpJsonAdapter({
    ...httpJsonSourceConfig(manifest.source),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })

  let loaded: Card[]
  try {
    const page = await adapter.fetch({})
    loaded = page.items
      .map((raw) => adapter.normalize(raw))
      .filter((card): card is Card => card !== null)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`could not fetch ${manifest.source.url}: ${message}`)
  }
  await stores.items.put(loaded)

  const api = createServer({ events: stores.events, items: stores.items, version: 'dev' })

  const handler = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const url = new URL(request.url ?? '/', 'http://localhost')

    if (url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(previewHtml(manifest, actor))
      return
    }

    if (url.pathname === '/dev/swipe' && request.method === 'POST') {
      try {
        const body = (await readJson(request)) as { cardId?: unknown; action?: unknown }
        const cardId = typeof body.cardId === 'string' ? body.cardId : ''
        const action = typeof body.action === 'string' ? body.action : ''
        if (!cardId || !action) {
          send(response, 400, { error: 'cardId and action are required' })
          return
        }
        const existing = await stores.events.query({ actor, deckId: manifest.id })
        const event = parseSwipeEvent({
          schemaVersion: 1,
          id: createUlid(),
          deckId: manifest.id,
          cardId,
          actor,
          action,
          position: existing.length,
          ts: new Date().toISOString(),
        })
        await stores.events.append([event])
        send(response, 202, { accepted: 1 })
      } catch (cause) {
        send(response, 400, { error: cause instanceof Error ? cause.message : String(cause) })
      }
      return
    }

    if (url.pathname.startsWith('/api/')) {
      // The playground speaks to the same routes a real client does.
      request.url = url.pathname.slice('/api'.length) + url.search
      await api.handler(request, response)
      return
    }

    send(response, 404, { error: 'not found' })
  }

  const server = createHttpServer((request, response) => {
    void handler(request, response)
  })

  const port = await new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 8787, options.host ?? '127.0.0.1', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address ? address.port : (options.port ?? 8787))
    })
  })

  return {
    url: `http://${options.host ?? '127.0.0.1'}:${port}`,
    port,
    cards: loaded,
    close: () =>
      new Promise<void>((done, fail) => {
        server.closeAllConnections()
        server.close((error) => (error ? fail(error) : done()))
      }),
  }
}

export { ACTIONS as DEV_ACTIONS }
