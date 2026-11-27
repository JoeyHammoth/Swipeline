<script lang="ts">
  import { cardView } from '@swipeline/cards'
  import type { DeckSnapshot, SwipeAction } from '@swipeline/core'
  import { actionButtons, createGestureController, keyIntent } from '@swipeline/gestures'
  import { createTranslator, formatNumber } from '@swipeline/i18n'
  import { untrack } from 'svelte'
  import type { SwipeDeckProps } from './types.js'

  let {
    store,
    label,
    actions,
    template = 'media',
    messages,
    locale,
    reducedMotion = false,
    card: cardSnippet,
    empty: emptySnippet,
  }: SwipeDeckProps = $props()

  // The initial read is deliberately not reactive — the effect below is what
  // subscribes and keeps the snapshot current.
  let snapshot = $state<DeckSnapshot>(untrack(() => store.getSnapshot()))
  let root = $state<HTMLElement>()

  const current = $derived(snapshot.cards[0])
  const busy = $derived(snapshot.state === 'loading' || snapshot.state === 'committing')
  const t = $derived(
    createTranslator(messages ?? {}, locale === undefined ? {} : { locale }),
  )

  function commit(action: SwipeAction): void {
    const card = store.getSnapshot().cards[0]
    if (!card) return
    store.dispatch({ type: 'swipe', action, cardId: card.id })
    root?.focus()
  }

  function onKeyDown(event: KeyboardEvent): void {
    const intent = keyIntent(event.key, actions ? { actions } : {})
    if (!intent) return
    event.preventDefault()
    if (intent.kind === 'undo') store.dispatch({ type: 'undo' })
    else commit(intent.action)
  }

  // Resubscribe when the store prop changes; the effect's cleanup detaches the
  // old subscription before attaching the new one.
  $effect(() => {
    const deck = store
    snapshot = deck.getSnapshot()
    return deck.subscribe(() => {
      snapshot = deck.getSnapshot()
    })
  })

  // One gesture controller per element. Reading `actions` and `reducedMotion`
  // here is what re-attaches it when either prop changes.
  $effect(() => {
    const element = root
    if (!element) return
    const controller = createGestureController({
      element,
      reducedMotion,
      ...(actions ? { actions } : {}),
      onIntent: (intent) => {
        if (intent.kind === 'commit') commit(intent.action)
      },
    })
    // Bound here rather than in the markup so the keyboard path is torn down
    // with the rest of the controller.
    element.addEventListener('keydown', onKeyDown)
    return () => {
      element.removeEventListener('keydown', onKeyDown)
      controller.destroy()
    }
  })
</script>

<!-- `role="application"` is the composite-widget contract the other bindings share:
     one tab stop for the whole deck, with keyboard handling inside it. The rule
     assumes a plain div cannot own that. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  bind:this={root}
  role="application"
  tabindex="0"
  aria-label={label ?? t.t('deck.label')}
  aria-busy={busy ? 'true' : undefined}
  data-state={snapshot.state}
>
  <p class="swl-live" aria-live="polite" aria-atomic="true">
    {current
      ? t.t('deck.announce', { title: current.title, position: snapshot.position + 1 })
      : ''}
  </p>

  {#if snapshot.state === 'error'}
    <div role="alert">
      <p>{snapshot.lastError?.message ?? t.t('error.load')}</p>
      {#if snapshot.lastError?.retryable}
        <button type="button" onclick={() => store.dispatch({ type: 'retry' })}>
          {t.t('deck.retry')}
        </button>
      {/if}
    </div>
  {/if}

  {#if snapshot.state === 'offline'}
    <div role="status">
      <p>{t.t('deck.offline')}</p>
      <button type="button" onclick={() => store.dispatch({ type: 'setOffline', offline: false })}>
        {t.t('deck.reconnect')}
      </button>
    </div>
  {/if}

  {#if busy && !current}
    <p role="status">{t.t('deck.loading')}</p>
  {/if}

  {#if !busy && !current && snapshot.state !== 'error' && snapshot.state !== 'offline'}
    {#if emptySnippet}
      {@render emptySnippet()}
    {:else}
      <p role="status">{t.t('deck.empty')}</p>
    {/if}
  {/if}

  {#if current}
    <article class="swl-card" data-testid="swl-current-card">
      {#if cardSnippet}
        {@render cardSnippet(current)}
      {:else}
        {@const view = cardView(current, template)}
        {@const cover = view.media?.[0]}
        {#if cover && cover.kind === 'image'}
          <img src={cover.url} alt={cover.alt ?? ''} loading="lazy" />
        {/if}
        <h2 class="swl-card__title">{view.title}</h2>
        {#if view.subtitle}
          <p class="swl-card__subtitle">{view.subtitle}</p>
        {/if}
        {#if view.facts && view.facts.length > 0}
          <dl class="swl-card__facts" aria-label={t.t('deck.facts')}>
            {#each view.facts as fact (fact.label)}
              <div>
                <dt>{fact.label}</dt>
                <dd>
                  {typeof fact.value === 'number'
                    ? formatNumber(fact.value, t.locale)
                    : fact.value}{fact.unit ? ` ${fact.unit}` : ''}
                </dd>
              </div>
            {/each}
          </dl>
        {/if}
        {#if view.body}
          <p class="swl-card__body">{view.body}</p>
        {/if}
        {#if view.tags && view.tags.length > 0}
          <ul class="swl-card__tags" aria-label={t.t('deck.tags')}>
            {#each view.tags as tag (tag)}
              <li>{tag}</li>
            {/each}
          </ul>
        {/if}
        {#if current.attribution}
          <p class="swl-card__attribution">
            {#if current.attribution.url}
              <a
                href={current.attribution.url}
                target="_blank"
                rel="noreferrer noopener">{current.attribution.text}</a
              >
            {:else}
              {current.attribution.text}
            {/if}
          </p>
        {/if}
      {/if}
    </article>
  {/if}

  <div class="swl-actions">
    {#each actionButtons(actions ? { actions } : {}) as button (button.direction)}
      {@const text = t.t(`actions.${button.action}`)}
      <button
        type="button"
        data-action={button.action}
        disabled={!current}
        aria-label={text === button.label
          ? button.ariaLabel
          : `${text} (${button.shortcut.replace('Arrow', '')})`}
        onclick={() => commit(button.action)}
      >
        {text}
      </button>
    {/each}
    <button
      type="button"
      data-action="undo"
      disabled={!snapshot.canUndo}
      aria-label={t.t('deck.undoAria')}
      onclick={() => store.dispatch({ type: 'undo' })}
    >
      {t.t('deck.undo')}
    </button>
  </div>
</div>
