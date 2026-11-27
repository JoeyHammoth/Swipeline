import { type CardTemplate, cardView, isCardTemplate } from '@swipeline/cards'
import type { Card, DeckSnapshot, DeckStore, SwipeAction } from '@swipeline/core'
import {
  actionButtons,
  createGestureController,
  type GestureController,
  keyIntent,
  type SwipeDirection,
} from '@swipeline/gestures'
import { createTranslator, formatNumber, type Messages, type Translator } from '@swipeline/i18n'
import { lightTheme } from '@swipeline/theme'

const HTMLElementBase = (
  typeof HTMLElement === 'undefined' ? class {} : HTMLElement
) as typeof HTMLElement

// Colours are written as `var(--swl-color-bg, #ffffff)`; the legacy single-purpose
// variables (`--swl-accent`, `--swl-radius`, `--swl-gap`, `--swl-duration`) stay
// first in the fallback chain so 0.1-era overrides keep working.
function tokenNameFor(name: 'bg' | 'fg' | 'muted' | 'border' | 'accent'): string {
  return `--swl-color-${name}`
}

const STYLES = `
  :host {
    contain: layout style;
    display: block;
    font-family: system-ui, sans-serif;
    color: var(${tokenNameFor('fg')}, ${lightTheme['color-fg']});
  }
  :host([hidden]) { display: none; }
  .swl-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .swl-card {
    border: 1px solid var(${tokenNameFor('border')}, ${lightTheme['color-border']});
    border-radius: var(--swl-radius, var(--swl-radius-card, ${lightTheme['radius-card']}));
    padding: var(--swl-space-4, ${lightTheme['space-4']});
    min-height: 12rem;
    background: var(${tokenNameFor('bg')}, ${lightTheme['color-bg']});
    transform: translate(var(--swl-drag-x, 0), var(--swl-drag-y, 0)) rotate(var(--swl-drag-rotate, 0deg));
    transition: transform var(--swl-duration, var(--swl-motion-slow, ${lightTheme['motion-slow']})) ease-out;
    touch-action: pan-y;
  }
  .swl-card img { width: 100%; max-height: 18rem; object-fit: cover; border-radius: calc(var(--swl-radius-card, ${lightTheme['radius-card']}) / 2); }
  .swl-title { margin: 0 0 0.25rem; font-size: 1.25rem; }
  .swl-subtitle { margin: 0 0 0.5rem; color: var(${tokenNameFor('muted')}, ${lightTheme['color-muted']}); }
  .swl-tags { display: flex; gap: var(--swl-space-1, ${lightTheme['space-1']}); flex-wrap: wrap; padding: 0; list-style: none; }
  .swl-tags li { background: #f3f4f6; border-radius: var(--swl-radius-control, ${lightTheme['radius-control']}); padding: 0.1rem var(--swl-space-2, ${lightTheme['space-2']}); font-size: 0.75rem; }
  .swl-facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr)); gap: var(--swl-space-3, ${lightTheme['space-3']}); margin: var(--swl-space-3, ${lightTheme['space-3']}) 0 0; }
  .swl-facts dt { font-size: 0.75rem; color: var(${tokenNameFor('muted')}, ${lightTheme['color-muted']}); }
  .swl-facts dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
  .swl-actions { display: flex; gap: var(--swl-gap, var(--swl-space-3, ${lightTheme['space-3']})); flex-wrap: wrap; margin-top: var(--swl-space-3, ${lightTheme['space-3']}); }
  button { border: 1px solid var(--swl-color-border, ${lightTheme['color-border']}); background: var(${tokenNameFor('bg')}, ${lightTheme['color-bg']}); color: inherit; border-radius: var(--swl-radius-control, ${lightTheme['radius-control']}); padding: 0.4rem 0.9rem; font: inherit; cursor: pointer; }
  button[data-action="like"] { border-color: var(--swl-accent, var(--swl-color-accent, ${lightTheme['color-accent']})); color: var(--swl-accent, var(--swl-color-accent, ${lightTheme['color-accent']})); }
  button:focus-visible, :host(:focus-visible) .swl-card { outline: 2px solid var(--swl-accent, var(--swl-color-accent, ${lightTheme['color-accent']})); outline-offset: 2px; }
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
 * Properties: `store` (a `DeckStore`), `renderCard(card)`, `actions`, `template`
 * and `messages`. Attributes: `label`, `template`, `reduced-motion`. Emits `swipe`
 * and `undo` DOM events, renders into open shadow DOM with `part`s, and uses a
 * `card` slot for a fully custom template.
 */
export class SwipeDeckElement extends HTMLElementBase {
  static get observedAttributes(): string[] {
    return ['label', 'template', 'reduced-motion']
  }

  #store: DeckStore | undefined
  #unsubscribe: (() => void) | undefined
  #controller: GestureController | undefined
  #actions: Partial<Record<SwipeDirection, SwipeAction>> | undefined
  #renderCard: ((card: Card) => Node) | undefined
  #template: CardTemplate = 'media'
  #messages: Messages | undefined
  #translator: Translator = createTranslator()
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

  /** The built-in template used when no `renderCard` is set. */
  set template(template: CardTemplate) {
    this.#template = template
    if (this.getAttribute('template') !== template) this.setAttribute('template', template)
    this.render()
  }

  get template(): CardTemplate {
    return this.#template
  }

  /** A partial catalog; anything it omits falls back to English. */
  set messages(messages: Messages | undefined) {
    this.#messages = messages
    this.#translator = createTranslator(messages ?? {})
    this.render()
  }

  get messages(): Messages | undefined {
    return this.#messages
  }

  get snapshot(): DeckSnapshot | undefined {
    return this.#store?.getSnapshot()
  }

  connectedCallback(): void {
    this.#connected = true
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0
    this.setAttribute('role', 'application')
    if (!this.hasAttribute('label'))
      this.setAttribute('aria-label', this.#translator.t('deck.label'))
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

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'label') {
      this.setAttribute('aria-label', value ?? this.#translator.t('deck.label'))
      return
    }
    if (name === 'template') {
      if (value !== null && isCardTemplate(value)) this.#template = value
      else if (value !== null) {
        // An unknown template is a configuration error, not a silent fallback.
        this.dispatchEvent(
          new CustomEvent('error', {
            detail: new TypeError(
              `Unknown card template "${value}". Use one of: text, media, facts.`,
            ),
            bubbles: true,
            composed: true,
          }),
        )
        return
      }
      this.render()
      return
    }
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
    const t = this.#translator
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
    if (current) {
      live.textContent = t.t('deck.announce', {
        title: current.title,
        position: (snapshot?.position ?? 0) + 1,
      })
    }
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
    if (state === 'loading' && !current) {
      root.append(element('p', 'swl-status', t.t('deck.loading')))
    }
    if (state === 'error') {
      const alert = element('div', 'swl-error')
      alert.setAttribute('role', 'alert')
      alert.textContent = snapshot?.lastError?.message ?? t.t('error.load')
      if (snapshot?.lastError?.retryable) {
        const retry = element('button', 'swl-retry', t.t('deck.retry'))
        retry.type = 'button'
        retry.addEventListener('click', () => this.#store?.dispatch({ type: 'retry' }))
        alert.append(retry)
      }
      root.append(alert)
    }
    if (state === 'offline') {
      const status = element('p', 'swl-status', t.t('deck.offline'))
      status.setAttribute('role', 'status')
      root.append(status)
    }
    if (snapshot && !current && state !== 'loading' && state !== 'error' && state !== 'offline') {
      const empty = element('p', 'swl-status', t.t('deck.empty'))
      empty.setAttribute('role', 'status')
      root.append(empty)
    }

    const actions = element('div', 'swl-actions')
    actions.setAttribute('part', 'actions')
    for (const button of actionButtons(this.#actions ? { actions: this.#actions } : {})) {
      const label = t.t(`actions.${button.action}`)
      const control = element('button', 'swl-action', label)
      control.type = 'button'
      control.dataset.action = button.action
      control.setAttribute('part', 'button')
      control.setAttribute(
        'aria-label',
        label === button.label
          ? button.ariaLabel
          : `${label} (${button.shortcut.replace('Arrow', '')})`,
      )
      control.disabled = !current
      control.addEventListener('click', () => this.commit(button.action))
      actions.append(control)
    }
    const undo = element('button', 'swl-action', t.t('deck.undo'))
    undo.type = 'button'
    undo.dataset.action = 'undo'
    undo.setAttribute('part', 'button')
    undo.setAttribute('aria-label', t.t('deck.undoAria'))
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
    const t = this.#translator
    const view = cardView(card, this.#template)
    const wrapper = element('div', 'swl-default')
    const cover = view.media?.[0]
    if (cover && cover.kind === 'image') {
      const image = document.createElement('img')
      image.src = cover.url
      image.alt = cover.alt ?? ''
      image.loading = 'lazy'
      wrapper.append(image)
    }
    wrapper.append(element('h2', 'swl-title', view.title))
    if (view.subtitle) {
      wrapper.append(element('p', 'swl-subtitle', view.subtitle))
    }
    if (view.facts && view.facts.length > 0) {
      const list = element('dl', 'swl-facts')
      list.setAttribute('aria-label', t.t('deck.facts'))
      for (const fact of view.facts) {
        const group = element('div', 'swl-fact')
        group.append(element('dt', '', fact.label))
        const value =
          typeof fact.value === 'number' ? formatNumber(fact.value, t.locale) : fact.value
        group.append(element('dd', '', fact.unit ? `${value} ${fact.unit}` : value))
        list.append(group)
      }
      wrapper.append(list)
    }
    if (view.body) {
      wrapper.append(element('p', 'swl-body', view.body))
    }
    if (view.tags && view.tags.length > 0) {
      const list = element('ul', 'swl-tags')
      list.setAttribute('aria-label', t.t('deck.tags'))
      for (const tag of view.tags) list.append(element('li', '', tag))
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
