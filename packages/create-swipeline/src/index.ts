import { existsSync } from 'node:fs'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export type TemplateName = 'blank' | 'books' | 'papers' | 'recipes' | 'products'

export const TEMPLATE_NAMES: readonly TemplateName[] = [
  'blank',
  'books',
  'papers',
  'recipes',
  'products',
]

export interface TemplateSummary {
  name: TemplateName
  title: string
  description: string
}

export const TEMPLATES: readonly TemplateSummary[] = [
  {
    name: 'blank',
    title: 'Blank',
    description: 'No framework, an in-memory source, and the <swipe-deck> element.',
  },
  {
    name: 'books',
    title: 'Books',
    description: 'React, Open Library, an IndexedDB history and the default ranker.',
  },
  {
    name: 'papers',
    title: 'Papers',
    description: 'React and Crossref metadata mapped through http-json.',
  },
  {
    name: 'recipes',
    title: 'Recipes',
    description: 'React and TheMealDB through http-json, no pagination.',
  },
  {
    name: 'products',
    title: 'Products',
    description: 'React and a product catalogue mapping to copy and edit.',
  },
]

export interface ScaffoldOptions {
  directory: string
  template: TemplateName
  /** Scaffold into a non-empty directory. */
  force?: boolean
  /**
   * Write `workspace:*` for `@swipeline/*` dependencies. Used by this repo's
   * template check, where the packages are not published yet.
   */
  linkWorkspace?: boolean
}

export interface ScaffoldResult {
  directory: string
  template: TemplateName
  files: readonly string[]
}

/** The release line the templates target; `scaffold.test.ts` keeps it in step with the packages. */
const VERSION = '^0.3.0'

/** Placeholder the generator replaces with a version or `workspace:*`. */
const V = '__SWIPELINE__'

const REACT_ENTRY = (
  label: string,
  slug: string,
): string => `import { createEngine, type Card } from '@swipeline/core'
import { SwipeDeck } from '@swipeline/react'
import '@swipeline/react/styles.css'
import { createIndexedDbStores } from '@swipeline/store-indexeddb'
import { createRoot } from 'react-dom/client'
import { deck } from './deck.config'
import './app.css'

function CardView({ card }: { card: Card }) {
  const image = card.media?.find((entry) => entry.kind === 'image')
  return (
    <article className="card">
      {image ? <img className="card__image" src={image.url} alt={image.alt ?? ''} loading="lazy" /> : null}
      <h2 className="card__title">{card.title}</h2>
      {card.subtitle ? <p className="card__subtitle">{card.subtitle}</p> : null}
      {card.tags && card.tags.length > 0 ? (
        <ul className="card__tags" aria-label="Tags">
          {card.tags.slice(0, 8).map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
      {card.attribution ? (
        <p className="card__attribution">
          <a href={card.attribution.url} target="_blank" rel="noreferrer noopener">
            {card.attribution.text}
          </a>
        </p>
      ) : null}
    </article>
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('The page is missing #root')

async function start(): Promise<void> {
  // IndexedDB keeps swipes and undo across reloads. Swap in another store
  // (memory, or @swipeline/store-remote) without touching the deck config.
  const stores = await createIndexedDbStores({ name: 'swipeline-${slug}' })
  const engine = createEngine({ ...deck, events: stores.events })
  engine.dispatch({ type: 'refill' })

  createRoot(rootElement as HTMLElement).render(
    <SwipeDeck store={engine} label="${label} deck" renderCard={(card) => <CardView card={card} />} />,
  )
}

void start()
`

const BLANK_ENTRY = `import { createEngine, type Card, type SourceAdapter } from '@swipeline/core'
import { defineSwipeDeck, type SwipeDeckElement } from '@swipeline/element'

// A source that needs no network, so this template runs immediately. Replace it
// with an adapter package or an http-json mapping from deck.config.ts.
const TITLES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']

const demoSource: SourceAdapter<string> = {
  id: 'demo',
  capabilities: { pagination: 'none' },
  async fetch() {
    return { items: TITLES }
  },
  normalize(raw: string): Card {
    return {
      schemaVersion: 1,
      id: \`demo:\${raw.toLowerCase()}\`,
      sourceId: 'demo',
      title: raw,
      body: 'Replace this adapter with your own source.',
      fetchedAt: new Date().toISOString(),
    }
  },
}

defineSwipeDeck()

const element = document.querySelector('swipe-deck') as SwipeDeckElement | null
if (!element) throw new Error('The page is missing <swipe-deck>')

const engine = createEngine({ deckId: 'demo', actor: 'local-reader', source: demoSource })
engine.dispatch({ type: 'refill' })
element.store = engine
`

const APP_CSS = `:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
}

.card {
  display: grid;
  gap: 0.5rem;
  max-width: 32rem;
}

.card__image {
  width: 100%;
  border-radius: 12px;
  object-fit: cover;
}

.card__title {
  margin: 0;
  font-size: 1.35rem;
}

.card__subtitle {
  margin: 0;
  opacity: 0.75;
}

.card__tags {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  padding: 0;
  margin: 0.5rem 0 0;
}

.card__tags li {
  font-size: 0.75rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  opacity: 0.75;
}

.card__attribution {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  opacity: 0.7;
}
`

const INDEX_HTML = (title: string, mount: string, entry: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
${mount}
    <script type="module" src="/src/${entry}"></script>
  </body>
</html>
`

const TSCONFIG = (jsx: boolean): string =>
  `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2023',
        lib: ['ES2023', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        ...(jsx ? { jsx: 'react-jsx' } : {}),
        strict: true,
        noUncheckedIndexedAccess: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
      include: ['src'],
    },
    null,
    2,
  )}\n`

const VITE_CONFIG = (react: boolean): string =>
  react
    ? `import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [react()] })
`
    : `import { defineConfig } from 'vite'

export default defineConfig({})
`

interface TemplateFiles {
  label: string
  react: boolean
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  /** `src/deck.config.ts`; absent for the blank template. */
  config?: string
  entry: string
  readme: string
}

const REACT_DEPS = {
  '@swipeline/core': V,
  '@swipeline/react': V,
  '@swipeline/store-indexeddb': V,
  react: '^19.3.1',
  'react-dom': '^19.3.1',
}

const REACT_DEV_DEPS = {
  '@types/react': '^19.3.0',
  '@types/react-dom': '^19.3.0',
  '@vitejs/plugin-react': '^4.7.0',
  typescript: '^7.0.2',
  vite: '^6.4.4',
}

const TEMPLATE_FILES: Record<TemplateName, TemplateFiles> = {
  blank: {
    label: 'Demo',
    react: false,
    dependencies: { '@swipeline/core': V, '@swipeline/element': V },
    devDependencies: { typescript: '^7.0.2', vite: '^6.4.4' },
    entry: BLANK_ENTRY,
    readme:
      '# Swipeline blank deck\n\nNo framework: the `<swipe-deck>` element, an in-memory source and no network.\n\n```bash\nnpm install\nnpm run dev\n```\n\nReplace `demoSource` in `src/main.ts` with your own `SourceAdapter`.\n',
  },
  books: {
    label: 'Books',
    react: true,
    dependencies: { ...REACT_DEPS, '@swipeline/adapter-openlibrary': V },
    devDependencies: REACT_DEV_DEPS,
    config: `import { createOpenLibraryAdapter } from '@swipeline/adapter-openlibrary'

export const deck = {
  deckId: 'books',
  actor: 'local-reader',
  source: createOpenLibraryAdapter({ limit: 40 }),
}
`,
    entry: REACT_ENTRY('Book', 'books'),
    readme:
      '# Swipeline books deck\n\nReact, Open Library search, an IndexedDB history and the default ranking\npipeline.\n\n```bash\nnpm install\nnpm run dev\n```\n\nAttribution: data from [Open Library](https://openlibrary.org). Respect their\nrate limits before increasing `limit`.\n',
  },
  papers: {
    label: 'Papers',
    react: true,
    dependencies: { ...REACT_DEPS, '@swipeline/adapter-http-json': V },
    devDependencies: REACT_DEV_DEPS,
    config: `import { httpJson } from '@swipeline/adapter-http-json'

export const deck = {
  deckId: 'papers',
  actor: 'local-reader',
  source: httpJson({
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
    pagination: { mode: 'offset', param: 'offset', pageSize: 20 },
    attribution: { text: 'Metadata from Crossref', url: 'https://www.crossref.org' },
  }),
}
`,
    entry: REACT_ENTRY('Paper', 'papers'),
    readme:
      '# Swipeline papers deck\n\nReact and Crossref metadata through the declarative `http-json` adapter.\nEdit the `map` in `src/deck.config.ts` to change what a card shows.\n\n```bash\nnpm install\nnpm run dev\n```\n',
  },
  recipes: {
    label: 'Recipes',
    react: true,
    dependencies: { ...REACT_DEPS, '@swipeline/adapter-http-json': V },
    devDependencies: REACT_DEV_DEPS,
    config: `import { httpJson } from '@swipeline/adapter-http-json'

export const deck = {
  deckId: 'recipes',
  actor: 'local-reader',
  source: httpJson({
    id: 'themealdb',
    url: 'https://www.themealdb.com/api/json/v1/1/filter.php?c=Seafood',
    itemsPath: 'meals',
    map: { id: 'idMeal', title: 'strMeal' },
    pagination: { mode: 'none' },
    attribution: { text: 'Data from TheMealDB', url: 'https://www.themealdb.com' },
  }),
}
`,
    entry: REACT_ENTRY('Recipe', 'recipes'),
    readme:
      '# Swipeline recipes deck\n\nReact and TheMealDB through `http-json`. The demo category has no pagination,\nso there is one page of cards.\n\n```bash\nnpm install\nnpm run dev\n```\n',
  },
  products: {
    label: 'Product',
    react: true,
    dependencies: { ...REACT_DEPS, '@swipeline/adapter-http-json': V },
    devDependencies: REACT_DEV_DEPS,
    config: `import { httpJson } from '@swipeline/adapter-http-json'

export const deck = {
  deckId: 'products',
  actor: 'local-reader',
  source: httpJson({
    id: 'catalogue',
    url: 'https://api.example.com/products?page={page}&limit=20',
    itemsPath: 'items',
    map: { id: 'sku', title: 'name', subtitle: 'brand', tags: 'tags[:8]' },
    pagination: { mode: 'page', param: 'page', pageSize: 20 },
  }),
}
`,
    entry: REACT_ENTRY('Product', 'products'),
    readme:
      '# Swipeline products deck\n\nReact and a product catalogue mapping to edit. Point `url` at your own API:\nthe field map is the whole integration.\n\n```bash\nnpm install\nnpm run dev\n```\n',
  },
}

function packageJson(name: string, files: TemplateFiles, linkWorkspace: boolean): string {
  const version = linkWorkspace ? 'workspace:*' : VERSION
  const rewrite = (dependencies: Record<string, string>): Record<string, string> =>
    Object.fromEntries(
      Object.entries(dependencies).map(([key, value]) => [key, value === V ? version : value]),
    )

  return `${JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
      dependencies: rewrite(files.dependencies),
      devDependencies: rewrite(files.devDependencies),
      engines: { node: '>=24' },
    },
    null,
    2,
  )}\n`
}

function directoryName(template: TemplateName): string {
  return `swipeline-${template}`
}

/**
 * Writes a runnable project. Templates are data rather than checked-in
 * directories, so the five share one code path and the check in
 * `scripts/check-templates.mjs` cannot drift from what users get.
 */
export async function scaffold(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const template = TEMPLATE_FILES[options.template]
  if (!template) throw new Error(`Unknown template: ${String(options.template)}`)

  const directory = options.directory
  if (existsSync(directory) && options.force !== true) {
    const entries = await readdir(directory)
    if (entries.length > 0) {
      throw new Error(`${directory} is not empty; pass --force to write into it anyway`)
    }
  }
  await mkdir(directory, { recursive: true })

  const react = template.react
  const files: Record<string, string> = {
    'package.json': packageJson(
      directoryName(options.template),
      template,
      options.linkWorkspace === true,
    ),
    'index.html': INDEX_HTML(
      `${template.label} · Swipeline`,
      react ? '    <div id="root"></div>' : '    <swipe-deck label="Demo deck"></swipe-deck>',
      react ? 'main.tsx' : 'main.ts',
    ),
    'tsconfig.json': TSCONFIG(react),
    'vite.config.ts': VITE_CONFIG(react),
    'README.md': template.readme,
    'src/app.css': APP_CSS,
    [react ? 'src/main.tsx' : 'src/main.ts']: template.entry,
  }
  if (template.config) files['src/deck.config.ts'] = template.config

  const written: string[] = []
  for (const [relative, content] of Object.entries(files)) {
    const path = join(directory, relative)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, 'utf8')
    written.push(relative)
  }
  return { directory, template: options.template, files: written.sort() }
}
