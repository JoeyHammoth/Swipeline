import { type CardTemplate, cardView } from '@swipeline/cards'
import type { Card, DeckSnapshot, DeckStore, SwipeAction } from '@swipeline/core'
import {
  actionButtons,
  createGestureController,
  keyIntent,
  type SwipeDirection,
} from '@swipeline/gestures'
import { createTranslator, formatNumber, type Messages, type Translator } from '@swipeline/i18n'
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react'

/** Subscribes a component to the engine's snapshot; SSR uses the stable server snapshot. */
export function useDeck(store: DeckStore): DeckSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

export interface SwipeDeckProps {
  store: DeckStore
  /** Accessible name for the deck region. Defaults to the translated "Swipe deck". */
  label?: string
  className?: string
  /** Per-direction action overrides; buttons and keys both follow this map. */
  actions?: Partial<Record<SwipeDirection, SwipeAction>>
  /** Custom card rendering. Replaces the built-in template entirely. */
  renderCard?: (card: Card) => ReactNode
  /** Shown when the deck is exhausted. */
  renderEmpty?: () => ReactNode
  /** Built-in card template used when `renderCard` is absent. */
  template?: CardTemplate
  /** Partial catalog; anything it omits falls back to English. */
  messages?: Messages
  /** BCP 47 tag used for number formatting in the `facts` template. */
  locale?: string
  /** Disable transform output for the drag layer. */
  reducedMotion?: boolean
}

export function SwipeDeck({
  store,
  label,
  className,
  actions,
  renderCard,
  renderEmpty,
  template = 'media',
  messages,
  locale,
  reducedMotion = false,
}: SwipeDeckProps) {
  const snapshot = useDeck(store)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastPosition = useRef(snapshot.position)
  const current = snapshot.cards[0]
  const preview = snapshot.cards[1]
  const t = useMemo(
    () => createTranslator(messages ?? {}, locale === undefined ? {} : { locale }),
    [messages, locale],
  )

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    // A composite deck needs one programmatic focus target. Set it imperatively:
    // a static tabIndex on a non-interactive element is flagged by the a11y
    // linter, while the runtime behaviour here is deliberate.
    element.tabIndex = 0
    const controller = createGestureController({
      element,
      reducedMotion,
      ...(actions ? { actions } : {}),
      onIntent: (intent) => {
        if (intent.kind !== 'commit') return
        const card = store.getSnapshot().cards[0]
        if (!card) return
        store.dispatch({ type: 'swipe', action: intent.action, cardId: card.id })
      },
    })
    return () => {
      controller.destroy()
      element.removeAttribute('tabindex')
    }
  }, [store, actions, reducedMotion])

  // Keep focus on the deck, never inside the card body, and only after a swipe.
  useEffect(() => {
    if (snapshot.position === lastPosition.current) return
    lastPosition.current = snapshot.position
    containerRef.current?.focus()
  }, [snapshot.position])

  const commit = (action: SwipeAction): void => {
    const card = store.getSnapshot().cards[0]
    if (card) store.dispatch({ type: 'swipe', action, cardId: card.id })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const intent = keyIntent(event.key, actions ? { actions } : {})
    if (!intent) return
    event.preventDefault()
    if (intent.kind === 'undo') store.dispatch({ type: 'undo' })
    else commit(intent.action)
  }

  const busy = snapshot.state === 'loading' || snapshot.state === 'committing'
  const empty = snapshot.cards.length === 0

  return (
    <div
      ref={containerRef}
      className={className}
      role="application"
      aria-label={label ?? t.t('deck.label')}
      aria-busy={busy}
      onKeyDown={onKeyDown}
      data-state={snapshot.state}
    >
      <p className="swl-live" aria-live="polite" aria-atomic="true">
        {current
          ? t.t('deck.announce', { title: current.title, position: snapshot.position + 1 })
          : ''}
      </p>

      {snapshot.state === 'error' ? (
        <div role="alert">
          <p>{snapshot.lastError?.message ?? t.t('error.load')}</p>
          {snapshot.lastError?.retryable ? (
            <button type="button" onClick={() => store.dispatch({ type: 'retry' })}>
              {t.t('deck.retry')}
            </button>
          ) : null}
        </div>
      ) : null}

      {snapshot.state === 'offline' ? (
        <div role="status">
          <p>{t.t('deck.offline')}</p>
          <button
            type="button"
            onClick={() => store.dispatch({ type: 'setOffline', offline: false })}
          >
            {t.t('deck.reconnect')}
          </button>
        </div>
      ) : null}

      {busy && empty ? <p role="status">{t.t('deck.loading')}</p> : null}

      {!busy && empty && snapshot.state !== 'error' && snapshot.state !== 'offline'
        ? (renderEmpty?.() ?? <p role="status">{t.t('deck.empty')}</p>)
        : null}

      {current ? (
        <article className="swl-card" data-testid="swl-current-card">
          {renderCard ? (
            renderCard(current)
          ) : (
            <DefaultCard card={current} template={template} t={t} />
          )}
        </article>
      ) : null}

      {preview ? (
        <div
          className="swl-preview"
          aria-hidden="true"
          // `inert` keeps a custom card's links and buttons out of the tab order;
          // aria-hidden alone still lets them take focus.
          inert
          data-testid="swl-preview-card"
        >
          {renderCard ? (
            renderCard(preview)
          ) : (
            <DefaultCard card={preview} template={template} t={t} />
          )}
        </div>
      ) : null}

      <div className="swl-actions">
        {actionButtons(actions ? { actions } : {}).map((button) => {
          const text = t.t(`actions.${button.action}`)
          return (
            <button
              key={button.direction}
              type="button"
              onClick={() => commit(button.action)}
              disabled={current === undefined}
              aria-label={
                text === button.label
                  ? button.ariaLabel
                  : `${text} (${button.shortcut.replace('Arrow', '')})`
              }
              data-action={button.action}
            >
              {text}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => store.dispatch({ type: 'undo' })}
          disabled={!snapshot.canUndo}
          aria-label={t.t('deck.undoAria')}
        >
          {t.t('deck.undo')}
        </button>
      </div>
    </div>
  )
}

function DefaultCard({ card, template, t }: { card: Card; template: CardTemplate; t: Translator }) {
  const view = cardView(card, template)
  const cover = view.media?.[0]
  return (
    <>
      {cover && cover.kind === 'image' ? (
        <img src={cover.url} alt={cover.alt ?? ''} loading="lazy" />
      ) : null}
      <h2 className="swl-card__title">{view.title}</h2>
      {view.subtitle ? <p className="swl-card__subtitle">{view.subtitle}</p> : null}
      {view.facts && view.facts.length > 0 ? (
        <dl className="swl-card__facts" aria-label={t.t('deck.facts')}>
          {view.facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>
                {typeof fact.value === 'number' ? formatNumber(fact.value, t.locale) : fact.value}
                {fact.unit ? ` ${fact.unit}` : ''}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {view.body ? <p className="swl-card__body">{view.body}</p> : null}
      {view.tags && view.tags.length > 0 ? (
        <ul className="swl-card__tags" aria-label={t.t('deck.tags')}>
          {view.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}
      {card.attribution ? (
        <p className="swl-card__attribution">
          {card.attribution.url ? (
            <a href={card.attribution.url} target="_blank" rel="noreferrer noopener">
              {card.attribution.text}
            </a>
          ) : (
            card.attribution.text
          )}
        </p>
      ) : null}
    </>
  )
}
