import type { Card, DeckSnapshot, DeckStore, SwipeAction } from '@swipeline/core'
import {
  actionButtons,
  createGestureController,
  keyIntent,
  type SwipeDirection,
} from '@swipeline/gestures'
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react'

/** Subscribes a component to the engine's snapshot; SSR uses the stable server snapshot. */
export function useDeck(store: DeckStore): DeckSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}

export interface SwipeDeckProps {
  store: DeckStore
  /** Accessible name for the deck region. */
  label?: string
  className?: string
  /** Per-direction action overrides; buttons and keys both follow this map. */
  actions?: Partial<Record<SwipeDirection, SwipeAction>>
  /** Custom card rendering. The default template renders text, tags and attribution. */
  renderCard?: (card: Card) => ReactNode
  /** Shown when the deck is exhausted. */
  renderEmpty?: () => ReactNode
  /** Disable transform output for the drag layer. */
  reducedMotion?: boolean
}

const DEFAULT_LABEL = 'Swipe deck'

export function SwipeDeck({
  store,
  label = DEFAULT_LABEL,
  className,
  actions,
  renderCard,
  renderEmpty,
  reducedMotion = false,
}: SwipeDeckProps) {
  const snapshot = useDeck(store)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastPosition = useRef(snapshot.position)
  const current = snapshot.cards[0]
  const preview = snapshot.cards[1]

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
      aria-label={label}
      aria-busy={busy}
      onKeyDown={onKeyDown}
      data-state={snapshot.state}
    >
      <p className="swl-live" aria-live="polite" aria-atomic="true">
        {current ? `${current.title}, card ${snapshot.position + 1}` : ''}
      </p>

      {snapshot.state === 'error' ? (
        <div role="alert">
          <p>{snapshot.lastError?.message ?? 'Could not load cards.'}</p>
          {snapshot.lastError?.retryable ? (
            <button type="button" onClick={() => store.dispatch({ type: 'retry' })}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {snapshot.state === 'offline' ? (
        <div role="status">
          <p>You are offline. Cards you already loaded are still available.</p>
          <button
            type="button"
            onClick={() => store.dispatch({ type: 'setOffline', offline: false })}
          >
            Reconnect
          </button>
        </div>
      ) : null}

      {busy && empty ? <p role="status">Loading cards…</p> : null}

      {!busy && empty && snapshot.state !== 'error' && snapshot.state !== 'offline'
        ? (renderEmpty?.() ?? <p role="status">No more cards.</p>)
        : null}

      {current ? (
        <article className="swl-card" data-testid="swl-current-card">
          {renderCard ? renderCard(current) : <DefaultCard card={current} />}
        </article>
      ) : null}

      {preview ? (
        <div className="swl-preview" aria-hidden="true" data-testid="swl-preview-card">
          {renderCard ? renderCard(preview) : <DefaultCard card={preview} />}
        </div>
      ) : null}

      <div className="swl-actions">
        {actionButtons(actions ? { actions } : {}).map((button) => (
          <button
            key={button.direction}
            type="button"
            onClick={() => commit(button.action)}
            disabled={current === undefined}
            aria-label={button.ariaLabel}
            data-action={button.action}
          >
            {button.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => store.dispatch({ type: 'undo' })}
          disabled={!snapshot.canUndo}
          aria-label="Undo last swipe (U)"
        >
          Undo
        </button>
      </div>
    </div>
  )
}

function DefaultCard({ card }: { card: Card }) {
  return (
    <>
      <h2 className="swl-card__title">{card.title}</h2>
      {card.subtitle ? <p className="swl-card__subtitle">{card.subtitle}</p> : null}
      {card.body ? <p className="swl-card__body">{card.body}</p> : null}
      {card.tags && card.tags.length > 0 ? (
        <ul className="swl-card__tags" aria-label="Tags">
          {card.tags.map((tag) => (
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
