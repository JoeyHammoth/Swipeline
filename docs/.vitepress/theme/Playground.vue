<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

type ActionName = 'like' | 'dislike' | 'superlike' | 'later'
type Side = 'left' | 'right' | 'up' | 'down'

interface SampleCard {
  id: string
  title: string
  subtitle: string
  body: string
  tags: string[]
  facts: Array<{ label: string; value: string }>
}

interface Dataset {
  label: string
  cards: SampleCard[]
}

interface Manifest {
  schemaVersion: 1
  id: string
  dataset: string
  actions: Record<Side, ActionName>
  pipeline: string[]
  tagWeight: number
}

interface HistoryEntry {
  cardId: string
  action: ActionName
  position: number
  ts: string
}

const WEIGHTS: Record<ActionName, number> = {
  like: 1,
  superlike: 2,
  later: 0.5,
  dislike: -0.6,
}

const ACTION_LABELS: Record<ActionName, string> = {
  like: 'Liked',
  superlike: 'Superliked',
  later: 'Saved for later',
  dislike: 'Passed on',
}

const ACTION_VALUES = new Set<ActionName>(['like', 'dislike', 'superlike', 'later'])
const STAGES = new Set(['seenFilter', 'tagAffinity'])

const DATASETS: Record<string, Dataset> = {
  books: {
    label: 'Books (bundled fixture)',
    cards: [
      {
        id: 'book:dune',
        title: 'Dune',
        subtitle: 'Frank Herbert · 1965',
        body: 'Politics, ecology and prophecy on a desert planet. A dense court intrigue wrapped around a coming-of-age story.',
        tags: ['science fiction', 'space opera', 'politics', 'classic'],
        facts: [
          { label: 'Pages', value: '617' },
          { label: 'Series', value: 'Dune #1' },
        ],
      },
      {
        id: 'book:left-hand',
        title: 'The Left Hand of Darkness',
        subtitle: 'Ursula K. Le Guin · 1969',
        body: 'An envoy visits a world whose people have no fixed sex, and learns how much of politics is assumptions about bodies.',
        tags: ['science fiction', 'anthropology', 'classic', 'slow burn'],
        facts: [
          { label: 'Pages', value: '304' },
          { label: 'Award', value: 'Hugo + Nebula' },
        ],
      },
      {
        id: 'book:neuromancer',
        title: 'Neuromancer',
        subtitle: 'William Gibson · 1984',
        body: 'A washed-up console cowboy is hired for one last run. The book that named cyberspace and set the cyberpunk template.',
        tags: ['science fiction', 'cyberpunk', 'heist', 'classic'],
        facts: [
          { label: 'Pages', value: '271' },
          { label: 'Award', value: 'Hugo + Nebula' },
        ],
      },
      {
        id: 'book:memory-empire',
        title: 'A Memory Called Empire',
        subtitle: 'Arkady Martine · 2019',
        body: 'A new ambassador arrives carrying the ghost of her predecessor, into an empire that absorbs cultures politely.',
        tags: ['science fiction', 'space opera', 'politics', 'mystery'],
        facts: [
          { label: 'Pages', value: '462' },
          { label: 'Award', value: 'Hugo' },
        ],
      },
      {
        id: 'book:dispossessed',
        title: 'The Dispossessed',
        subtitle: 'Ursula K. Le Guin · 1974',
        body: 'A physicist walks between an anarchist moon and its capitalist neighbour, and finds both societies shaped by scarcity.',
        tags: ['science fiction', 'politics', 'classic', 'slow burn'],
        facts: [
          { label: 'Pages', value: '341' },
          { label: 'Award', value: 'Hugo + Nebula' },
        ],
      },
      {
        id: 'book:hyperion',
        title: 'Hyperion',
        subtitle: 'Dan Simmons · 1989',
        body: 'Seven pilgrims tell their stories on the way to a creature that may be a god, a weapon or a mistake.',
        tags: ['science fiction', 'space opera', 'horror', 'structure'],
        facts: [
          { label: 'Pages', value: '482' },
          { label: 'Series', value: 'Hyperion Cantos #1' },
        ],
      },
      {
        id: 'book:piranesi',
        title: 'Piranesi',
        subtitle: 'Susanna Clarke · 2020',
        body: 'A man lives in an endless house of statues and tides, keeping careful notes about a world he cannot explain.',
        tags: ['fantasy', 'mystery', 'slow burn', 'unreliable narrator'],
        facts: [
          { label: 'Pages', value: '245' },
          { label: 'Award', value: 'Women’s Prize' },
        ],
      },
      {
        id: 'book:hail-mary',
        title: 'Project Hail Mary',
        subtitle: 'Andy Weir · 2021',
        body: 'A lone astronaut wakes with no memory and one job: stop the Sun from dimming. Engineering puzzles, warm humour.',
        tags: ['science fiction', 'hard sci-fi', 'space opera', 'fast paced'],
        facts: [
          { label: 'Pages', value: '476' },
          { label: 'Narrator', value: 'Ray Porter' },
        ],
      },
    ],
  },
  papers: {
    label: 'Papers (bundled fixture)',
    cards: [
      {
        id: 'paper:attention',
        title: 'Attention Is All You Need',
        subtitle: 'Vaswani et al. · 2017',
        body: 'Replaces recurrence with self-attention and defines the transformer block that most language models still use.',
        tags: ['transformers', 'nlp', 'architecture', 'foundational'],
        facts: [
          { label: 'Citations', value: '100k+' },
          { label: 'Venue', value: 'NeurIPS' },
        ],
      },
      {
        id: 'paper:lora',
        title: 'LoRA: Low-Rank Adaptation of Large Language Models',
        subtitle: 'Hu et al. · 2021',
        body: 'Freezes the base model and trains small low-rank matrices, making fine-tuning cheap enough for one GPU.',
        tags: ['fine-tuning', 'efficiency', 'llm', 'practical'],
        facts: [
          { label: 'Params trained', value: '~0.01%' },
          { label: 'Venue', value: 'ICLR' },
        ],
      },
      {
        id: 'paper:chinchilla',
        title: 'Training Compute-Optimal Large Language Models',
        subtitle: 'Hoffmann et al. · 2022',
        body: 'Shows most large models are undertrained: for a fixed compute budget, more data and fewer parameters wins.',
        tags: ['scaling', 'training', 'llm', 'empirical'],
        facts: [
          { label: 'Model', value: '70B' },
          { label: 'Tokens', value: '1.4T' },
        ],
      },
      {
        id: 'paper:dpo',
        title: 'Direct Preference Optimization',
        subtitle: 'Rafailov et al. · 2023',
        body: 'Turns preference alignment into a classification loss, removing the separate reward model and RL loop.',
        tags: ['alignment', 'rlhf', 'llm', 'practical'],
        facts: [
          { label: 'Compared to', value: 'PPO-based RLHF' },
          { label: 'Venue', value: 'NeurIPS' },
        ],
      },
      {
        id: 'paper:flashattention',
        title: 'FlashAttention',
        subtitle: 'Dao et al. · 2022',
        body: 'Reorders attention computation to keep blocks in SRAM, making long-context training markedly faster.',
        tags: ['efficiency', 'attention', 'systems', 'practical'],
        facts: [
          { label: 'Speedup', value: '2–4×' },
          { label: 'Venue', value: 'NeurIPS' },
        ],
      },
      {
        id: 'paper:rag',
        title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP',
        subtitle: 'Lewis et al. · 2020',
        body: 'Pairs a retriever with a generator so answers can cite documents instead of relying on parameters alone.',
        tags: ['retrieval', 'nlp', 'llm', 'foundational'],
        facts: [
          { label: 'Components', value: 'DPR + BART' },
          { label: 'Venue', value: 'NeurIPS' },
        ],
      },
      {
        id: 'paper:moe',
        title: 'Switch Transformers',
        subtitle: 'Fedus et al. · 2021',
        body: 'Routes each token to one of many experts, scaling parameter count without scaling per-token compute.',
        tags: ['mixture of experts', 'scaling', 'efficiency', 'architecture'],
        facts: [
          { label: 'Largest', value: '1.6T params' },
          { label: 'Venue', value: 'JMLR' },
        ],
      },
      {
        id: 'paper:mamba',
        title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
        subtitle: 'Gu & Dao · 2023',
        body: 'A selective state-space model with linear scaling in sequence length, positioned as an attention alternative.',
        tags: ['architecture', 'efficiency', 'sequence models', 'new'],
        facts: [
          { label: 'Complexity', value: 'O(n)' },
          { label: 'Code', value: 'open source' },
        ],
      },
    ],
  },
}

const DEFAULT_MANIFEST: Manifest = {
  schemaVersion: 1,
  id: 'playground',
  dataset: 'books',
  actions: { left: 'dislike', right: 'like', up: 'superlike', down: 'later' },
  pipeline: ['seenFilter', 'tagAffinity'],
  tagWeight: 0.7,
}

const manifest = ref<Manifest>(cloneManifest(DEFAULT_MANIFEST))
const history = ref<HistoryEntry[]>([])
const announcement = ref('')
const copied = ref(false)
const importError = ref('')

function cloneManifest(source: Manifest): Manifest {
  return {
    ...source,
    actions: { ...source.actions },
    pipeline: [...source.pipeline],
  }
}

const EMPTY_DATASET: Dataset = { label: 'Empty', cards: [] }

const dataset = computed<Dataset>(
  () => DATASETS[manifest.value.dataset] ?? EMPTY_DATASET,
)
const cards = computed(() => dataset.value.cards)
const seenIds = computed(() => new Set(history.value.map((entry) => entry.cardId)))

const profile = computed(() => {
  const stats: Record<string, { a: number; b: number }> = {}
  for (const entry of history.value) {
    const card = cards.value.find((candidate) => candidate.id === entry.cardId)
    const weight = WEIGHTS[entry.action]
    for (const tag of card?.tags ?? []) {
      const key = tag.toLowerCase()
      const current = stats[key] ?? { a: 0, b: 0 }
      stats[key] = {
        a: current.a + Math.max(weight, 0),
        b: current.b + Math.max(-weight, 0),
      }
    }
  }
  return stats
})

const affinities = computed(() => {
  const result: Record<string, number> = {}
  for (const [tag, stats] of Object.entries(profile.value)) {
    result[tag] = (stats.a - stats.b) / (stats.a + stats.b + 1)
  }
  return result
})

function affinityOf(tag: string): number {
  return affinities.value[tag.toLowerCase()] ?? 0
}

function scoreOf(card: SampleCard): number {
  if (card.tags.length === 0) return 0
  const average = card.tags.reduce((sum, tag) => sum + affinityOf(tag), 0) / card.tags.length
  return manifest.value.tagWeight * average
}

function reasonFor(card: SampleCard): string {
  const best = [...card.tags]
    .map((tag) => ({ tag, score: affinityOf(tag) }))
    .sort((left, right) => right.score - left.score)[0]
  if (!best || best.score <= 0.01) return 'New area: position until related tags have evidence'
  return `${best.tag} affinity ${best.score.toFixed(2)}`
}

const ranked = computed(() =>
  cards.value
    .filter((card) => !seenIds.value.has(card.id))
    .map((card, index) => ({ card, index, score: scoreOf(card), reason: reasonFor(card) }))
    .sort((left, right) => right.score - left.score || left.index - right.index),
)

const current = computed(() => ranked.value[0])
const upNext = computed(() => ranked.value[1])
const canUndo = computed(() => history.value.length > 0)
const likeCount = computed(
  () => history.value.filter((entry) => entry.action === 'like' || entry.action === 'superlike').length,
)
const topTags = computed(() =>
  Object.entries(affinities.value)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, 5),
)

function swipe(action: ActionName): void {
  const entry = current.value
  if (!entry) return
  history.value = [
    ...history.value,
    {
      cardId: entry.card.id,
      action,
      position: history.value.length,
      ts: new Date().toISOString(),
    },
  ]
  announcement.value = `${ACTION_LABELS[action]}: ${entry.card.title}`
  copied.value = false
}

function undo(): void {
  const last = history.value.at(-1)
  if (!last) return
  const card = cards.value.find((candidate) => candidate.id === last.cardId)
  history.value = history.value.slice(0, -1)
  announcement.value = `Undid ${ACTION_LABELS[last.action].toLowerCase()}${card ? ` on ${card.title}` : ''}`
}

function reset(): void {
  history.value = []
  announcement.value = 'Deck reset'
  copied.value = false
  importError.value = ''
}

function changeDataset(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (!(value in DATASETS)) return
  manifest.value = { ...manifest.value, dataset: value }
  reset()
}

function changeTagWeight(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  manifest.value = { ...manifest.value, tagWeight: Math.min(1, Math.max(0, value / 100)) }
}

function encodeManifest(value: Manifest): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeManifest(value: string): Manifest | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return validateManifest(parsed)
  } catch {
    return null
  }
}

function validateManifest(data: unknown): Manifest | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  const keys = Object.keys(record).sort().join(',')
  if (keys !== 'actions,dataset,id,pipeline,schemaVersion,tagWeight') return null
  if (record.schemaVersion !== 1) return null
  if (typeof record.id !== 'string' || record.id.length === 0 || record.id.length > 64) return null
  if (typeof record.dataset !== 'string' || !(record.dataset in DATASETS)) return null
  if (typeof record.tagWeight !== 'number' || !Number.isFinite(record.tagWeight)) return null
  if (record.tagWeight < 0 || record.tagWeight > 1) return null
  if (!Array.isArray(record.pipeline)) return null
  if (record.pipeline.some((stage) => typeof stage !== 'string' || !STAGES.has(stage))) return null
  if (typeof record.actions !== 'object' || record.actions === null) return null
  const actions = record.actions as Record<string, unknown>
  if (Object.keys(actions).sort().join(',') !== 'down,left,right,up') return null
  for (const side of ['left', 'right', 'up', 'down'] as const) {
    const value = actions[side]
    if (typeof value !== 'string' || !ACTION_VALUES.has(value as ActionName)) return null
  }
  return {
    schemaVersion: 1,
    id: record.id,
    dataset: record.dataset,
    actions: actions as Record<Side, ActionName>,
    pipeline: [...record.pipeline] as string[],
    tagWeight: record.tagWeight,
  }
}

async function share(): Promise<void> {
  const hash = `#manifest=${encodeManifest(manifest.value)}`
  window.history.replaceState(null, '', hash)
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${hash}`)
    copied.value = true
  } catch {
    copied.value = false
  }
}

function download(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportManifest(): void {
  download('playground.manifest.json', `${JSON.stringify(manifest.value, null, 2)}\n`, 'application/json')
}

function exportHistory(): void {
  const lines = history.value.map((entry) =>
    JSON.stringify({
      schemaVersion: 1,
      deckId: manifest.value.id,
      cardId: entry.cardId,
      action: entry.action,
      position: entry.position,
      ts: entry.ts,
    }),
  )
  download('swipes.jsonl', lines.length === 0 ? '' : `${lines.join('\n')}\n`, 'application/x-ndjson')
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null
  if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      swipe(manifest.value.actions.left)
      return
    case 'ArrowRight':
      event.preventDefault()
      swipe(manifest.value.actions.right)
      return
    case 'ArrowUp':
      event.preventDefault()
      swipe(manifest.value.actions.up)
      return
    case 'ArrowDown':
      event.preventDefault()
      swipe(manifest.value.actions.down)
      return
    case 'u':
    case 'U':
      undo()
      return
  }
}

onMounted(() => {
  const match = /(?:^#|&)manifest=([^&]+)/.exec(window.location.hash)
  if (match?.[1]) {
    const parsed = decodeManifest(decodeURIComponent(match[1]))
    if (parsed) {
      manifest.value = parsed
      announcement.value = 'Loaded a shared deck manifest.'
    } else {
      importError.value =
        'That share link was not a valid Swipeline manifest, so the default deck was loaded instead.'
    }
  }
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="swl-playground">
    <div class="swl-controls">
      <label>
        <span>Source</span>
        <select :value="manifest.dataset" @change="changeDataset">
          <option v-for="(value, key) in DATASETS" :key="key" :value="key">
            {{ value.label }}
          </option>
        </select>
      </label>
      <label>
        <span>Tag weight {{ Math.round(manifest.tagWeight * 100) }}%</span>
        <input
          type="range"
          min="0"
          max="100"
          :value="Math.round(manifest.tagWeight * 100)"
          @input="changeTagWeight"
        />
      </label>
      <button type="button" class="swl-ghost" @click="reset">Reset deck</button>
    </div>

    <p v-if="importError" class="swl-warning" role="status">{{ importError }}</p>

    <div class="swl-body">
      <section class="swl-deck" aria-label="Card deck">
        <article v-if="current" class="swl-card">
          <p class="swl-kicker">{{ current.card.subtitle }}</p>
          <h3>{{ current.card.title }}</h3>
          <ul class="swl-tags" aria-label="Tags">
            <li v-for="tag in current.card.tags" :key="tag">{{ tag }}</li>
          </ul>
          <p class="swl-copy">{{ current.card.body }}</p>
          <dl class="swl-facts">
            <template v-for="fact in current.card.facts" :key="fact.label">
              <dt>{{ fact.label }}</dt>
              <dd>{{ fact.value }}</dd>
            </template>
          </dl>
          <p class="swl-why"><strong>Why this card:</strong> {{ current.reason }}</p>
          <p v-if="upNext" class="swl-next">Up next: {{ upNext.card.title }}</p>
        </article>

        <div v-else class="swl-card swl-empty">
          <h3>You have seen every card in this deck</h3>
          <p>Reset to run the same fixture again; nothing was uploaded anywhere.</p>
          <button type="button" @click="reset">Start over</button>
        </div>

        <div class="swl-actions" role="group" aria-label="Swipe actions">
          <button
            type="button"
            class="swl-dislike"
            :disabled="!current"
            @click="swipe(manifest.actions.left)"
          >
            Dislike
          </button>
          <button type="button" class="swl-ghost" :disabled="!canUndo" @click="undo">Undo</button>
          <button
            type="button"
            class="swl-superlike"
            :disabled="!current"
            @click="swipe(manifest.actions.up)"
          >
            Superlike
          </button>
          <button
            type="button"
            class="swl-like"
            :disabled="!current"
            @click="swipe(manifest.actions.right)"
          >
            Like
          </button>
        </div>
        <p class="swl-hint">Keyboard: ← → ↑ ↓ to swipe, U to undo. Buttons do everything a gesture can.</p>
        <p class="swl-live" aria-live="polite">{{ announcement }}</p>
      </section>

      <aside class="swl-panel" aria-label="Live profile and manifest">
        <h3>Your taste</h3>
        <ul v-if="topTags.length > 0" class="swl-taste">
          <li v-for="[tag, value] in topTags" :key="tag">
            <span class="swl-taste-tag">{{ tag }}</span>
            <span class="swl-bar" aria-hidden="true">
              <span
                class="swl-bar-fill"
                :class="{ negative: value < 0 }"
                :style="{ width: `${Math.round(Math.abs(value) * 100)}%` }"
              />
            </span>
            <span class="swl-taste-value">{{ value.toFixed(2) }}</span>
          </li>
        </ul>
        <p v-else class="swl-muted">
          Swipe a few cards to build a profile. It is derived in this tab from your own actions and
          never leaves the page.
        </p>

        <h3>Pipeline</h3>
        <ol class="swl-pipeline">
          <li v-for="stage in manifest.pipeline" :key="stage">{{ stage }}</li>
        </ol>
        <p class="swl-muted">
          Playground v0 runs <code>seenFilter</code> and <code>tagAffinity</code> in the browser. The
          rest of the default pipeline ships with <code>@swipeline/rank</code> in M2.
        </p>

        <p class="swl-stats">
          {{ history.length }} swipes · {{ likeCount }} likes · {{ cards.length }} cards
        </p>

        <div class="swl-buttons">
          <button type="button" @click="share">Copy share link</button>
          <button type="button" class="swl-ghost" @click="exportManifest">Export manifest</button>
          <button type="button" class="swl-ghost" :disabled="history.length === 0" @click="exportHistory">
            Export history (JSONL)
          </button>
        </div>
        <p v-if="copied" class="swl-muted">
          Link copied. It encodes only the manifest above: no swipes and no executable code.
        </p>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.swl-playground {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 16px;
  background: var(--vp-c-bg-soft);
  margin: 24px 0;
}

.swl-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 16px;
}

.swl-controls label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.swl-controls select,
.swl-controls input[type='range'] {
  min-width: 180px;
}

.swl-controls select {
  padding: 6px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.swl-body {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 20px;
}

@media (max-width: 720px) {
  .swl-body {
    grid-template-columns: minmax(0, 1fr);
  }
}

.swl-card {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 8%);
}

.swl-kicker {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}

.swl-card h3 {
  margin: 8px 0 12px;
  font-size: 24px;
  line-height: 1.2;
}

.swl-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}

.swl-tags li {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
}

.swl-copy {
  margin: 0 0 16px;
  color: var(--vp-c-text-1);
}

.swl-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 0 0 16px;
  padding: 12px 0;
  border-top: 1px solid var(--vp-c-divider);
  border-bottom: 1px solid var(--vp-c-divider);
}

.swl-facts dt {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}

.swl-facts dd {
  margin: 0;
  font-weight: 600;
}

.swl-why {
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.swl-next {
  margin: 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.swl-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.swl-actions button {
  flex: 1 1 90px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-weight: 600;
  cursor: pointer;
}

.swl-actions button:disabled,
.swl-buttons button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.swl-actions .swl-like {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.swl-actions .swl-superlike {
  border-color: #b58900;
  color: #b58900;
}

.swl-actions .swl-dislike {
  border-color: #c2410c;
  color: #c2410c;
}

.swl-hint,
.swl-muted {
  font-size: 12px;
  color: var(--vp-c-text-2);
  margin: 10px 0 0;
}

.swl-live {
  min-height: 18px;
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.swl-panel h3 {
  margin: 0 0 8px;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vp-c-text-2);
}

.swl-panel h3:not(:first-child) {
  margin-top: 20px;
}

.swl-taste {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.swl-taste li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 90px 40px;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}

.swl-taste-tag {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.swl-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--vp-c-divider);
  overflow: hidden;
}

.swl-bar-fill {
  display: block;
  height: 100%;
  background: var(--vp-c-brand-1);
}

.swl-bar-fill.negative {
  background: #c2410c;
}

.swl-taste-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-2);
}

.swl-pipeline {
  margin: 0 0 8px;
  padding-left: 20px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.swl-stats {
  margin: 16px 0 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.swl-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.swl-buttons button {
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.swl-buttons .swl-ghost,
.swl-ghost {
  background: transparent;
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.swl-warning {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-left: 3px solid #b58900;
  background: rgb(181 137 0 / 10%);
  font-size: 13px;
}

.swl-empty {
  text-align: center;
}

.swl-empty button {
  margin-top: 12px;
  padding: 8px 14px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .swl-playground * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
