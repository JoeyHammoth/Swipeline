# Quickstart

**Target: a working deck in under ten minutes on a clean machine.** That is goal
G1 in the design plan and the quickstart job in CI enforces it.

::: warning Not installable yet
This is the v0.1 flow. Today `@swipeline/core` is an unpublished workspace
package, so `npm create swipeline@latest` does not exist yet. What you *can* do
today is the [contributor setup](#contributor-setup) below.
:::

## The v0.1 flow

```bash
npm create swipeline@latest my-deck -- --template books
cd my-deck
npm install
npm run dev
```

You get a React app with:

- a `deck.config.ts` that maps Open Library search results into `Card`s,
- an IndexedDB store, so swipes survive a reload,
- the default ranking pipeline,
- accessible buttons and arrow-key shortcuts.

Open `http://localhost:5173`. Every file is meant to be edited: the config is the
product.

## Add it to an existing app

```bash
npm install @swipeline/core @swipeline/react @swipeline/adapters @swipeline/store-indexeddb
```

```tsx
import { SwipeDeck } from '@swipeline/react'
import '@swipeline/react/styles.css'
import { books } from './deck.config'

export default function App() {
  return <SwipeDeck deck={books} query="science fiction" />
}
```

See [Add to an existing app](/getting-started/add-to-existing-app) for custom
cards, ranking and consent controls.

## Contributor setup

The repository is a pnpm workspace. Node 24 or newer is required.

```bash
git clone https://github.com/JoeyHammoth/Swipeline.git
cd Swipeline
corepack enable            # installs the pinned pnpm
pnpm install
pnpm build
pnpm test
pnpm docs:dev              # this site, locally
```

Checks that must pass before a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm check:boundaries      # no framework imports outside bindings
pnpm licenses:check
```

## What to read next

1. [Cards and adapters](/concepts/cards-and-adapters) — the data model you will
   spend most of your time with.
2. [Events, profiles and history](/concepts/events-and-profiles) — why the log is
   the source of truth.
3. [Ranking](/concepts/ranking) — what the default pipeline does and when to
   replace it.
