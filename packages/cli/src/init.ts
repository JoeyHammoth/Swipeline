import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createHttpJsonAdapter, httpJsonSourceConfig } from '@swipeline/adapter-http-json'
import {
  type Card,
  type DeckManifest,
  type DeckManifestSource,
  deckManifestSchema,
  parseDeckManifest,
} from '@swipeline/core'

/** The manifest file `init`, `source add` and `dev` read and write. */
export const CONFIG_FILE = 'swipeline.deck.json'

export type TemplateName = 'blank' | 'books' | 'papers' | 'recipes' | 'products'

export const TEMPLATE_NAMES: readonly TemplateName[] = [
  'blank',
  'books',
  'papers',
  'recipes',
  'products',
]

/**
 * The starting source for each template. All five are declarative HTTP/JSON
 * sources, because a manifest cannot carry code; a hand-written adapter is added
 * to `deck.config.ts` by hand instead.
 */
const TEMPLATE_SOURCES: Record<TemplateName, DeckManifestSource> = {
  blank: {
    type: 'http-json',
    id: 'example',
    url: 'https://api.example.com/items?page={page}&limit=20',
    itemsPath: 'items',
    map: { id: 'id', title: 'title', subtitle: 'subtitle' },
    pagination: { type: 'page', param: 'page', pageSize: 20 },
  },
  books: {
    type: 'http-json',
    id: 'openlibrary',
    url: 'https://openlibrary.org/search.json?q={query}&page={page}&limit=20',
    itemsPath: 'docs',
    map: { id: 'key', title: 'title', subtitle: 'author_name[0]', tags: 'subject[:8]' },
    pagination: { type: 'page', param: 'page', pageSize: 20 },
    attribution: { text: 'Data from Open Library', url: 'https://openlibrary.org' },
  },
  papers: {
    type: 'http-json',
    id: 'crossref',
    url: 'https://api.crossref.org/works?query={query}&rows=20&offset={offset}',
    itemsPath: 'message.items',
    map: {
      id: 'DOI',
      title: 'title[0]',
      subtitle: 'publisher',
      tags: 'subject[:8]',
      url: 'URL',
    },
    pagination: { type: 'offset', param: 'offset', pageSize: 20 },
    attribution: { text: 'Metadata from Crossref', url: 'https://www.crossref.org' },
  },
  recipes: {
    type: 'http-json',
    id: 'themealdb',
    url: 'https://www.themealdb.com/api/json/v1/1/filter.php?c=Seafood',
    itemsPath: 'meals',
    map: { id: 'idMeal', title: 'strMeal' },
    pagination: { type: 'none' },
    attribution: { text: 'Data from TheMealDB', url: 'https://www.themealdb.com' },
  },
  products: {
    type: 'http-json',
    id: 'products',
    url: 'https://api.example.com/products?page={page}&limit=20',
    itemsPath: 'items',
    map: { id: 'sku', title: 'name', subtitle: 'brand', tags: 'tags[:8]' },
    pagination: { type: 'page', param: 'page', pageSize: 20 },
  },
}

export type Framework = 'react' | 'vue' | 'svelte' | 'none'

export interface InitOptions {
  directory: string
  template: TemplateName
  /** Deck id. Defaults to the template name. */
  id?: string
  /** Overwrite an existing manifest. */
  force?: boolean
}

export interface InitResult {
  path: string
  created: boolean
  framework: Framework
  manifest: DeckManifest
}

/** Detects the framework from a package.json, without installing anything. */
export async function detectFramework(directory: string): Promise<Framework> {
  let manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  try {
    manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
  } catch {
    return 'none'
  }
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies }
  if (dependencies.react) return 'react'
  if (dependencies.vue) return 'vue'
  if (dependencies.svelte) return 'svelte'
  return 'none'
}

export function frameworkHint(framework: Framework): string {
  if (framework === 'react')
    return 'next: npm install @swipeline/react, then render <SwipeDeck> with this deck'
  if (framework === 'vue')
    return 'next: add a binding package once the Vue binding ships (tracked in M4)'
  if (framework === 'svelte')
    return 'next: add a binding package once the Svelte binding ships (tracked in M4)'
  return 'next: npm install @swipeline/element and drop <swipe-deck> into a page'
}

/**
 * Writes a manifest into an existing project. It never touches an existing
 * manifest unless `force` is set, because overwriting a deck config silently
 * would lose the mapping someone just wrote.
 */
export async function initDeck(options: InitOptions): Promise<InitResult> {
  const directory = options.directory
  const path = join(directory, CONFIG_FILE)
  await mkdir(directory, { recursive: true })

  const manifest = parseDeckManifest({
    id: options.id ?? options.template,
    actor: 'local',
    source: TEMPLATE_SOURCES[options.template],
  })

  const framework = await detectFramework(directory)
  if (existsSync(path) && options.force !== true) {
    return { path, created: false, framework, manifest }
  }

  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return { path, created: true, framework, manifest }
}

export interface AddSourceOptions {
  url: string
  /** Source id used in card ids. Defaults to the host name. */
  id?: string
  /** Manifest to update. Written when it does not exist. */
  configPath: string
  /** Deck id used when a new manifest is created. */
  deckId?: string
  fetch?: typeof globalThis.fetch
  /** Rows to preview. Defaults to 3. */
  preview?: number
}

export interface AddSourceResult {
  source: DeckManifestSource
  path: string
  manifest: DeckManifest
  cards: Card[]
  dropped: number
}

const ID_KEYS = ['id', '_id', 'key', 'guid', 'uuid', 'slug', 'idMeal', 'DOI', 'sku', 'href', 'url']
const TITLE_KEYS = ['title', 'name', 'label', 'headline', 'strMeal', 'display_name']
const SUBTITLE_KEYS = [
  'subtitle',
  'author',
  'author_name[0]',
  'brand',
  'publisher',
  'strCategory',
  'description',
]
const TAG_KEYS = ['tags', 'subject', 'subjects', 'categories', 'genre']
const URL_KEYS = ['url', 'link', 'href', 'URL']

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function looksLikeRows(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.length > 0 && value.every(isRecord)
}

/**
 * Finds the first array of objects, so a response wrapped as `{ results: [...] }`
 * or `{ message: { items: [...] } }` maps without the caller spelling out a path.
 */
function findRows(
  json: unknown,
  prefix = '',
): { itemsPath: string | undefined; rows: Record<string, unknown>[] } | undefined {
  if (looksLikeRows(json)) return { itemsPath: prefix === '' ? undefined : prefix, rows: json }
  if (!isRecord(json)) return undefined
  for (const [key, value] of Object.entries(json)) {
    const path = prefix === '' ? key : `${prefix}.${key}`
    const found = findRows(value, path)
    if (found) return found
  }
  return undefined
}

function firstKey(
  row: Record<string, unknown>,
  candidates: readonly string[],
  options: { arrays?: boolean } = {},
): string | undefined {
  for (const candidate of candidates) {
    const value = row[candidate]
    if (typeof value === 'string' && value.trim() !== '') return candidate
    if (typeof value === 'number') return candidate
    // Cross-API titles such as Crossref's are arrays; the first element is the
    // title, and `readPath` expresses that as `title[0]`.
    if (options.arrays === true && Array.isArray(value)) {
      const [first] = value
      if (typeof first === 'string' && first.trim() !== '') return `${candidate}[0]`
      if (typeof first === 'number') return `${candidate}[0]`
    }
  }
  return undefined
}

/** Tags map either as a plain string (comma-separated) or a sliced array. */
function tagExpression(row: Record<string, unknown>): string | undefined {
  for (const candidate of TAG_KEYS) {
    const value = row[candidate]
    if (Array.isArray(value) && value.length > 0) return `${candidate}[:8]`
    if (typeof value === 'string' && value.trim() !== '') return candidate
  }
  return undefined
}

function sourceIdFrom(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '')
  const label = host.split('.').slice(0, -1).join('-') || host
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-|-$/g, '') || 'source'
  )
}

/**
 * Reads a sample from a URL, infers a field map from the first record and
 * previews the cards it would produce. The inference is deliberately shallow:
 * it maps flat scalar fields, because guessing at nested objects would produce a
 * config that looks right and silently drops rows.
 */
export async function addSource(options: AddSourceOptions): Promise<AddSourceResult> {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const response = await fetchImpl(options.url, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`${options.url} responded ${response.status}`)
  }
  const json: unknown = await response.json()
  const found = findRows(json)
  if (!found) {
    throw new Error('no array of objects in the response; add a mapping by hand')
  }

  const [sample] = found.rows
  const id = firstKey(sample ?? {}, ID_KEYS)
  const title = firstKey(sample ?? {}, TITLE_KEYS, { arrays: true })
  if (!id || !title) {
    throw new Error(
      `could not find an id and a title field; keys seen: ${Object.keys(sample ?? {}).join(', ')}`,
    )
  }

  const source: DeckManifestSource = {
    type: 'http-json',
    id: options.id ?? sourceIdFrom(options.url),
    url: options.url,
    map: { id, title },
    pagination: { type: 'none' },
  }
  if (found.itemsPath !== undefined) source.itemsPath = found.itemsPath
  const subtitle = firstKey(sample ?? {}, SUBTITLE_KEYS, { arrays: true })
  if (subtitle) source.map.subtitle = subtitle
  const tags = tagExpression(sample ?? {})
  if (tags) source.map.tags = tags
  const cardUrl = firstKey(sample ?? {}, URL_KEYS)
  if (cardUrl) source.map.url = cardUrl

  const adapter = createHttpJsonAdapter({
    ...httpJsonSourceConfig(source),
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })
  const preview = found.rows.slice(0, options.preview ?? 3)
  const cards: Card[] = []
  for (const row of preview) {
    const card = adapter.normalize(row)
    if (card) cards.push(card)
  }

  let manifest: DeckManifest
  const path = options.configPath
  try {
    manifest = parseDeckManifest(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    manifest = parseDeckManifest({
      id: options.deckId ?? source.id,
      actor: 'local',
      source,
    })
  }
  manifest = deckManifestSchema.parse({ ...manifest, source })
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  return {
    source,
    path,
    manifest,
    cards,
    dropped: preview.length - cards.length,
  }
}

/** Reads and validates a manifest file. */
export async function loadManifest(path: string): Promise<DeckManifest> {
  return parseDeckManifest(JSON.parse(await readFile(path, 'utf8')))
}
