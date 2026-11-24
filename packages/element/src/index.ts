import type { Card, DeckSnapshot, DeckStore, SwipeAction } from '@swipeline/core'
import {
  actionButtons,
  createGestureController,
  type GestureController,
  keyIntent,
  type SwipeDirection,
} from '@swipeline/gestures'

const HTMLElementBase = (
  typeof HTMLElement === 'undefined' ? class {} : HTMLElement
) as typeof HTMLElement

const STYLES = `
  :host {
    --swl-accent: #2563eb;
    --swl-radius: 16px;
    --swl-gap: 0.75rem;
    --swl-duration: 220ms;
    display: block;
    font-family: system-ui, sans-serif;
    color: #111827;
  }
  :host([hidden]) { display: none; }
  .swl-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .swl-card {
    border: 1px solid #e5e7eb;
    border-radius: var(--swl-radius);
    padding: 1rem;
    min-height: 12rem;
    background: #fff;
    transform: translate(var(--swl-drag-x, 0), var(--swl-drag-y, 0)) rotate(var(--swl-drag-rotate, 0deg));
    transition: transform var(--swl-duration) ease-out;
    touch-action: pan-y;
  }
  .swl-card img { width: 100%; max-height: 18rem; object-fit: cover; border-radius: calc(var(--swl-radius) / 2); }
  .swl-title { margin: 0 0 0.25rem; font-size: 1.25rem; }
  .swl-subtitle { margin: 0 0 0.5rem; color: #4b5563; }
  .swl-tags { display: flex; gap: 0.25rem; flex-wrap: wrap; padding: 0; list-style: none; }
  .swl-tags li { background: #f3f4f6; border-radius: 999px; padding: 0.1rem 0.5rem; font-size: 0.75rem; }
  .swl-actions { display: flex; gap: var(--swl-gap); flex-wrap: wrap; margin-top: 0.75rem; }
  button { border: 1px solid #d1d5db; background: #fff; border-radius: 999px; padding: 0.4rem 0.9rem; font: inherit; cursor: pointer; }
  button[data-action="like"] { border-color: var(--swl-accent); color: var(--swl-accent); }
  button:focus-visible, :host(:focus-visible) .swl-card { outline: 2px solid var(--swl-accent); outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    .swl-card { transition-duration: 0ms; transform: none !important; }
  }
`

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * `<swipe-deck>` — the framework-free reference binding.
 *
 * Properties: `store` (a `DeckStore`), `renderCard(card)` and the `label` /
 * `reduced-motion` attributes. Emits `swipe` and `undo` DOM events, renders
 * into open shadow DOM with `part`s, and uses slots for a custom card template.
 */
export class SwipeDeckElement extends HTMLElementBase {
  static get observedAttributes(): string[] {
    return ['label', 'reduced-motion']
  }

  #store: DeckStore | undefined
  #unsubscribe: (() => void) | undefined
  #controller: GestureController | undefined
  #actions: Partial<Record<SwipeDirection, SwipeAction>> | undefined
  #renderCard: ((card: Card) => Node) | undefined
  #lastPosition = 0
  #connected = false

  constructor() {
    super()
    this.attachShadow?.({ mode: 'open' })
  }

  get store(): DeckStore | undefined {
    return this.#store
  }

  set store(store: DeckStore | undefined) {
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
    this.#store = store
    if (this.#connected) this.#subscribe()
    this.render()
  }

  set actions(actions: Partial<Record<SwipeDirection, SwipeAction>> | undefined) {
    this.#actions = actions
    this.render()
  }

  get actions(): Partial<Record<SwipeDirection, SwipeAction>> | undefined {
    return this.#actions
  }

  set renderCard(renderer: ((card: Card) => Node) | undefined) {
    this.#renderCard = renderer
    this.render()
  }

  get renderCard(): ((card: Card) => Node) | undefined {
    return this.#renderCard
  }

  get snapshot(): DeckSnapshot | undefined {
    return this.#store?.getSnapshot()
  }

  connectedCallback(): void {
    this.#connected = true
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0
    this.setAttribute('role', 'application')
    if (!this.hasAttribute('label')) this.setAttribute('aria-label', 'Swipe deck')
    this.addEventListener('keydown', this.#onKeyDown)
    this.#subscribe()
    this.render()
  }

  disconnectedCallback(): void {
    this.#connected = false
    this.removeEventListener('keydown', this.#onKeyDown)
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
    this.#controller?.destroy()
    this.#controller = undefined
  }

  attributeChangedCallback(name: string): void {
    if (name === 'label')
      this.setAttribute('aria-label', this.getAttribute('label') ?? 'Swipe deck')
    if (name === 'reduced-motion') this.render()
  }

  #subscribe(): void {
    if (!this.#store || this.#unsubscribe) return
    this.#unsubscribe = this.#store.subscribe(() => this.render())
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    const intent = keyIntent(event.key, this.#actions ? { actions: this.#actions } : {})
    if (!intent) return
    event.preventDefault()
    if (intent.kind === 'undo') this.undo()
    else this.commit(intent.action)
  }

  #reducedMotion(): boolean {
    if (this.hasAttribute('reduced-motion')) return true
    return typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  }

  #cardId(): string | undefined {
    return this.#store?.getSnapshot().cards[0]?.id
  }

  commit(action: SwipeAction): void {
    const cardId = this.#cardId()
    if (!cardId) return
    this.#store?.dispatch({ type: 'swipe', action, cardId })
    this.dispatchEvent(
      new CustomEvent('swipe', { detail: { action, cardId }, bubbles: true, composed: true }),
    )
    this.focus()
  }

  undo(): void {
    if (!this.#store?.getSnapshot().canUndo) return
    this.#store.dispatch({ type: 'undo' })
    this.dispatchEvent(new CustomEvent('undo', { bubbles: true, composed: true }))
    this.focus()
  }

  render(): void {
    const root = this.shadowRoot
    if (!root) return
    const snapshot = this.#store?.getSnapshot()
    this.#controller?.destroy()
    this.#controller = undefined
    root.replaceChildren()

    const style = document.createElement('style')
    style.textContent = STYLES
    root.append(style)

    const live = element('p', 'swl-live')
    live.setAttribute('aria-live', 'polite')
    live.setAttribute('aria-atomic', 'true')
    const current = snapshot?.cards[0]
    if (current) live.textContent = `${current.title}, card ${(snapshot?.position ?? 0) + 1}`
    root.append(live)

    const card = element('div', 'swl-card')
    card.setAttribute('part', 'card')
    if (current) {
      if (this.#renderCard) card.append(this.#renderCard(current))
      else {
        const slot = document.createElement('slot')
        slot.name = 'card'
        slot.append(this.#defaultCard(current))
        card.append(slot)
      }
      this.#controller = createGestureController({
        element: card,
        reducedMotion: this.#reducedMotion(),
        ...(this.#actions ? { actions: this.#actions } : {}),
        onIntent: (intent) => {
          if (intent.kind === 'commit') this.commit(intent.action)
        },
      })
    }
    root.append(card)

    const state = snapshot?.state
    if (state === 'loading' && !current) root.append(element('p', 'swl-status', 'Loading cards…'))
    if (state === 'error') {
      const alert = element('div', 'swl-error')
      alert.setAttribute('role', 'alert')
      alert.textContent = snapshot?.lastError?.message ?? 'Could not load cards.'
      if (snapshot?.lastError?.retryable) {
        const retry = element('button', 'swl-retry', 'Retry')
        retry.type = 'button'
        retry.addEventListener('click', () => this.#store?.dispatch({ type: 'retry' }))
        alert.append(retry)
      }
      root.append(alert)
    }
    if (state === 'offline') {
      const status = element(
        'p',
        'swl-status',
        'You are offline. Loaded cards are still available.',
      )
      status.setAttribute('role', 'status')
      root.append(status)
    }
    if (snapshot && !current && state !== 'loading' && state !== 'error' && state !== 'offline') {
      const empty = element('p', 'swl-status', 'No more cards.')
      empty.setAttribute('role', 'status')
      root.append(empty)
    }

    const actions = element('div', 'swl-actions')
    actions.setAttribute('part', 'actions')
    for (const button of actionButtons(this.#actions ? { actions: this.#actions } : {})) {
      const control = element('button', 'swl-action', button.label)
      control.type = 'button'
      control.dataset.action = button.action
      control.setAttribute('part', 'button')
      control.setAttribute('aria-label', button.ariaLabel)
      control.disabled = !current
      control.addEventListener('click', () => this.commit(button.action))
      actions.append(control)
    }
    const undo = element('button', 'swl-action', 'Undo')
    undo.type = 'button'
    undo.dataset.action = 'undo'
    undo.setAttribute('part', 'button')
    undo.setAttribute('aria-label', 'Undo last swipe (U)')
    undo.disabled = !snapshot?.canUndo
    undo.addEventListener('click', () => this.undo())
    actions.append(undo)
    root.append(actions)

    if (snapshot && snapshot.position !== this.#lastPosition) {
      this.#lastPosition = snapshot.position
      this.focus()
    }
  }

  #defaultCard(card: Card): HTMLElement {
    const wrapper = element('div', 'swl-default')
    const cover = card.media?.find((media) => media.kind === 'image')
    if (cover) {
      const image = document.createElement('img')
      image.src = cover.url
      image.alt = cover.alt ?? ''
      wrapper.append(image)
    }
    wrapper.append(element('h2', 'swl-title', card.title))
    if (card.subtitle) wrapper.append(element('p', 'swl-subtitle', card.subtitle))
    if (card.body) wrapper.append(element('p', 'swl-body', card.body))
    if (card.tags && card.tags.length > 0) {
      const list = element('ul', 'swl-tags')
      list.setAttribute('aria-label', 'Tags')
      for (const tag of card.tags) list.append(element('li', '', tag))
      wrapper.append(list)
    }
    if (card.attribution) {
      const attribution = element('p', 'swl-attribution')
      if (card.attribution.url) {
        const link = document.createElement('a')
        link.href = card.attribution.url
        link.target = '_blank'
        link.rel = 'noreferrer noopener'
        link.textContent = card.attribution.text
        attribution.append(link)
      } else attribution.textContent = card.attribution.text
      wrapper.append(attribution)
    }
    return wrapper
  }
}

export function defineSwipeDeck(tagName = 'swipe-deck'): void {
  if (typeof customElements === 'undefined' || customElements.get(tagName)) return
  customElements.define(tagName, SwipeDeckElement)
}

if (typeof customElements !== 'undefined') defineSwipeDeck()

declare global {
  interface HTMLElementTagNameMap {
    'swipe-deck': SwipeDeckElement
  }
}
