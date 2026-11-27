import { type CardTemplate, cardView } from '@swipeline/cards'
import type { Card, DeckSnapshot, DeckStore, SwipeAction } from '@swipeline/core'
import {
  actionButtons,
  createGestureController,
  type GestureController,
  keyIntent,
  type SwipeDirection,
} from '@swipeline/gestures'
import { createTranslator, formatNumber, type Messages, type Translator } from '@swipeline/i18n'
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  type PropType,
  ref,
  shallowRef,
  type VNodeChild,
  watch,
} from 'vue'

/**
 * `<SwipeDeck>` for Vue 3 — the same behaviour as the React binding: pointer and
 * keyboard paths, a polite live region, and a default card template that reads
 * its fields from `@swipeline/cards`.
 *
 * The `card` slot receives the card, so a custom template stays reactive without
 * a render prop.
 */
export const SwipeDeck = defineComponent({
  name: 'SwipeDeck',
  props: {
    store: { type: Object as PropType<DeckStore>, required: true },
    /** Accessible name for the deck region; defaults to the translated one. */
    label: { type: String, default: undefined },
    actions: {
      type: Object as PropType<Partial<Record<SwipeDirection, SwipeAction>>>,
      default: undefined,
    },
    template: { type: String as PropType<CardTemplate>, default: 'media' },
    messages: { type: Object as PropType<Messages>, default: undefined },
    locale: { type: String, default: undefined },
    reducedMotion: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const snapshot = shallowRef<DeckSnapshot>(props.store.getSnapshot())
    const root = ref<HTMLElement | null>(null)
    let unsubscribe: (() => void) | undefined
    let controller: GestureController | undefined

    const translator = (): Translator =>
      createTranslator(
        props.messages ?? {},
        props.locale === undefined ? {} : { locale: props.locale },
      )

    const subscribe = (): void => {
      unsubscribe?.()
      snapshot.value = props.store.getSnapshot()
      unsubscribe = props.store.subscribe(() => {
        snapshot.value = props.store.getSnapshot()
      })
    }

    const attachController = (): void => {
      const element = root.value
      if (!element) return
      // A composite deck needs one programmatic focus target; a static tabindex in
      // the markup would be flagged by the a11y linter.
      element.tabIndex = 0
      controller?.destroy()
      controller = createGestureController({
        element,
        reducedMotion: props.reducedMotion,
        ...(props.actions ? { actions: props.actions } : {}),
        onIntent: (intent) => {
          if (intent.kind === 'commit') commit(intent.action)
        },
      })
    }

    const commit = (action: SwipeAction): void => {
      const card = props.store.getSnapshot().cards[0]
      if (!card) return
      props.store.dispatch({ type: 'swipe', action, cardId: card.id })
      root.value?.focus()
    }

    const lastPosition = { value: snapshot.value.position }

    onMounted(() => {
      subscribe()
      attachController()
    })

    onBeforeUnmount(() => {
      unsubscribe?.()
      unsubscribe = undefined
      controller?.destroy()
      controller = undefined
      root.value?.removeAttribute('tabindex')
    })

    watch(() => props.store, subscribe)
    watch([() => props.actions, () => props.reducedMotion], attachController)
    watch(
      () => snapshot.value.position,
      (position) => {
        if (position === lastPosition.value) return
        lastPosition.value = position
        root.value?.focus()
      },
    )

    const onKeyDown = (event: KeyboardEvent): void => {
      const intent = keyIntent(event.key, props.actions ? { actions: props.actions } : {})
      if (!intent) return
      event.preventDefault()
      if (intent.kind === 'undo') props.store.dispatch({ type: 'undo' })
      else commit(intent.action)
    }

    const defaultCard = (card: Card, t: Translator) => {
      const view = cardView(card, props.template)
      const cover = view.media?.[0]
      return [
        cover && cover.kind === 'image'
          ? h('img', { src: cover.url, alt: cover.alt ?? '', loading: 'lazy' })
          : null,
        h('h2', { class: 'swl-card__title' }, view.title),
        view.subtitle ? h('p', { class: 'swl-card__subtitle' }, view.subtitle) : null,
        view.facts && view.facts.length > 0
          ? h(
              'dl',
              { class: 'swl-card__facts', 'aria-label': t.t('deck.facts') },
              view.facts.map((fact) =>
                h('div', { key: fact.label }, [
                  h('dt', null, fact.label),
                  h('dd', null, [
                    typeof fact.value === 'number'
                      ? formatNumber(fact.value, t.locale)
                      : fact.value,
                    fact.unit ? ` ${fact.unit}` : '',
                  ]),
                ]),
              ),
            )
          : null,
        view.body ? h('p', { class: 'swl-card__body' }, view.body) : null,
        view.tags && view.tags.length > 0
          ? h(
              'ul',
              { class: 'swl-card__tags', 'aria-label': t.t('deck.tags') },
              view.tags.map((tag) => h('li', { key: tag }, tag)),
            )
          : null,
        card.attribution
          ? h('p', { class: 'swl-card__attribution' }, [
              card.attribution.url
                ? h(
                    'a',
                    { href: card.attribution.url, target: '_blank', rel: 'noreferrer noopener' },
                    card.attribution.text,
                  )
                : card.attribution.text,
            ])
          : null,
      ]
    }

    return () => {
      const state = snapshot.value
      const t = translator()
      const current = state.cards[0]
      const busy = state.state === 'loading' || state.state === 'committing'

      const status: VNodeChild[] = []
      if (state.state === 'error') {
        status.push(
          h('div', { role: 'alert' }, [
            h('p', null, state.lastError?.message ?? t.t('error.load')),
            state.lastError?.retryable
              ? h(
                  'button',
                  { type: 'button', onClick: () => props.store.dispatch({ type: 'retry' }) },
                  t.t('deck.retry'),
                )
              : null,
          ]),
        )
      }
      if (state.state === 'offline') {
        status.push(
          h('div', { role: 'status' }, [
            h('p', null, t.t('deck.offline')),
            h(
              'button',
              {
                type: 'button',
                onClick: () => props.store.dispatch({ type: 'setOffline', offline: false }),
              },
              t.t('deck.reconnect'),
            ),
          ]),
        )
      }
      if (busy && !current) status.push(h('p', { role: 'status' }, t.t('deck.loading')))
      if (!busy && !current && state.state !== 'error' && state.state !== 'offline') {
        status.push(slots.empty ? slots.empty() : h('p', { role: 'status' }, t.t('deck.empty')))
      }

      const actions = actionButtons(props.actions ? { actions: props.actions } : {}).map(
        (button) => {
          const text = t.t(`actions.${button.action}`)
          return h(
            'button',
            {
              key: button.direction,
              type: 'button',
              'data-action': button.action,
              disabled: current === undefined,
              'aria-label':
                text === button.label
                  ? button.ariaLabel
                  : `${text} (${button.shortcut.replace('Arrow', '')})`,
              onClick: () => commit(button.action),
            },
            text,
          )
        },
      )

      return h(
        'div',
        {
          ref: root,
          role: 'application',
          'aria-label': props.label ?? t.t('deck.label'),
          'aria-busy': busy || undefined,
          'data-state': state.state,
          onKeydown: onKeyDown,
        },
        [
          h(
            'p',
            { class: 'swl-live', 'aria-live': 'polite', 'aria-atomic': 'true' },
            current
              ? t.t('deck.announce', { title: current.title, position: state.position + 1 })
              : '',
          ),
          ...status,
          current
            ? h(
                'article',
                { class: 'swl-card', 'data-testid': 'swl-current-card' },
                slots.card ? slots.card({ card: current }) : defaultCard(current, t),
              )
            : null,
          h('div', { class: 'swl-actions' }, [
            ...actions,
            h(
              'button',
              {
                type: 'button',
                'data-action': 'undo',
                disabled: !state.canUndo,
                'aria-label': t.t('deck.undoAria'),
                onClick: () => props.store.dispatch({ type: 'undo' }),
              },
              t.t('deck.undo'),
            ),
          ]),
        ],
      )
    }
  },
})

export default SwipeDeck
