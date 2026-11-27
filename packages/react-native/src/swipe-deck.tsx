import { type CardTemplate, cardView } from '@swipeline/cards'
import type { Card, DeckStore, SwipeAction } from '@swipeline/core'
import { actionButtons, type SwipeDirection } from '@swipeline/gestures'
import { createTranslator, formatNumber, type Messages, type Translator } from '@swipeline/i18n'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { announcementFor, intentFromGesture } from './decision.js'
import { useDeck } from './use-deck.js'

const IDLE = { dx: 0, dy: 0 } as const

export interface SwipeDeckProps {
  store: DeckStore
  /** Accessible name for the deck. Defaults to the translated "Swipe deck". */
  label?: string
  /** Per-direction action overrides; buttons and gestures both follow this map. */
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
  /** Skip the drag transform. VoiceOver and TalkBack also announce the change. */
  reducedMotion?: boolean
}

/**
 * The React Native binding. It renders the shared card templates and string
 * catalog, uses the platform announcement API instead of a live region, and
 * leaves the deck state in the engine: every control dispatches to the same
 * `DeckStore` the web bindings use.
 *
 * Drags are handled with `PanResponder` from React Native core rather than
 * Gesture Handler, so a consumer needs no extra native install, no config
 * plugin and no custom dev client. The commit decision is still the shared
 * `computeSwipeIntent`, so thresholds and directions match the web.
 */
export function SwipeDeck({
  store,
  label,
  actions,
  renderCard,
  renderEmpty,
  template = 'media',
  messages,
  locale,
  reducedMotion = false,
}: SwipeDeckProps) {
  const snapshot = useDeck(store)
  const [drag, setDrag] = useState<{ dx: number; dy: number }>(IDLE)
  const current = snapshot.cards[0]
  const preview = snapshot.cards[1]
  const t = useMemo(
    () => createTranslator(messages ?? {}, locale === undefined ? {} : { locale }),
    [messages, locale],
  )

  const commit = useCallback(
    (action: SwipeAction): void => {
      const card = store.getSnapshot().cards[0]
      if (card) store.dispatch({ type: 'swipe', action, cardId: card.id })
    },
    [store],
  )

  const panResponder = useMemo(() => {
    const options = actions ? { actions } : {}
    return PanResponder.create({
      // Let the deck's buttons and any scroll view win until the finger actually
      // travels; a tap must not be swallowed by the drag surface.
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
      onPanResponderMove: (_event, gesture) => {
        setDrag({ dx: gesture.dx, dy: gesture.dy })
      },
      onPanResponderRelease: (_event, gesture) => {
        setDrag(IDLE)
        const intent = intentFromGesture(
          {
            translationX: gesture.dx,
            translationY: gesture.dy,
            velocityX: gesture.vx,
            velocityY: gesture.vy,
          },
          options,
        )
        if (intent.kind === 'commit') commit(intent.action)
      },
      onPanResponderTerminate: () => setDrag(IDLE),
    })
  }, [actions, commit])

  // One announcement per card. VoiceOver and TalkBack do not read a changed
  // `Text` on their own, so the binding asks the platform to speak it.
  const announced = useRef('')
  useEffect(() => {
    const text = announcementFor(current, snapshot.position, t)
    if (text === '' || text === announced.current) return
    announced.current = text
    AccessibilityInfo.announceForAccessibility(text)
  }, [current, snapshot.position, t])

  const busy = snapshot.state === 'loading' || snapshot.state === 'committing'
  const empty = snapshot.cards.length === 0
  const dragging = drag.dx !== 0 || drag.dy !== 0
  const dragStyle =
    reducedMotion || !dragging
      ? undefined
      : {
          transform: [
            { translateX: drag.dx },
            { translateY: drag.dy },
            { rotate: `${drag.dx / 40}deg` },
          ],
        }

  return (
    <View
      {...panResponder.panHandlers}
      accessibilityLabel={label ?? t.t('deck.label')}
      style={styles.root}
      testID="swl-deck"
    >
      {snapshot.state === 'error' ? (
        <View accessibilityRole="alert">
          <Text style={styles.status}>{snapshot.lastError?.message ?? t.t('error.load')}</Text>
          {snapshot.lastError?.retryable ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => store.dispatch({ type: 'retry' })}
              style={styles.button}
            >
              <Text style={styles.buttonLabel}>{t.t('deck.retry')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {snapshot.state === 'offline' ? (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.status}>{t.t('deck.offline')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => store.dispatch({ type: 'setOffline', offline: false })}
            style={styles.button}
          >
            <Text style={styles.buttonLabel}>{t.t('deck.reconnect')}</Text>
          </Pressable>
        </View>
      ) : null}

      {busy && empty ? (
        <Text accessibilityLiveRegion="polite" style={styles.status}>
          {t.t('deck.loading')}
        </Text>
      ) : null}

      {!busy && empty && snapshot.state !== 'error' && snapshot.state !== 'offline'
        ? (renderEmpty?.() ?? (
            <Text accessibilityLiveRegion="polite" style={styles.status}>
              {t.t('deck.empty')}
            </Text>
          ))
        : null}

      {current ? (
        <View style={[styles.card, dragStyle]} testID="swl-current-card">
          {renderCard ? (
            renderCard(current)
          ) : (
            <DefaultCard card={current} template={template} t={t} />
          )}
        </View>
      ) : null}

      {preview ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.preview} testID="swl-preview-card">
            {renderCard ? (
              renderCard(preview)
            ) : (
              <DefaultCard card={preview} template={template} t={t} />
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {actionButtons(actions ? { actions } : {}).map((button) => {
          const text = t.t(`actions.${button.action}`)
          return (
            <Pressable
              key={button.direction}
              accessibilityRole="button"
              accessibilityLabel={
                text === button.label
                  ? button.ariaLabel
                  : `${text} (${button.shortcut.replace('Arrow', '')})`
              }
              accessibilityState={{ disabled: current === undefined }}
              disabled={current === undefined}
              onPress={() => commit(button.action)}
              style={styles.button}
              testID={`swl-action-${button.action}`}
            >
              <Text style={styles.buttonLabel}>{text}</Text>
            </Pressable>
          )
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.t('deck.undoAria')}
          accessibilityState={{ disabled: !snapshot.canUndo }}
          disabled={!snapshot.canUndo}
          onPress={() => store.dispatch({ type: 'undo' })}
          style={styles.button}
          testID="swl-action-undo"
        >
          <Text style={styles.buttonLabel}>{t.t('deck.undo')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

function DefaultCard({ card, template, t }: { card: Card; template: CardTemplate; t: Translator }) {
  const view = cardView(card, template)
  const cover = view.media?.[0]
  return (
    <View>
      {cover && cover.kind === 'image' ? (
        <Image
          accessibilityLabel={cover.alt ?? ''}
          source={{ uri: cover.url }}
          style={styles.cover}
        />
      ) : null}
      <Text accessibilityRole="header" style={styles.title}>
        {view.title}
      </Text>
      {view.subtitle ? <Text style={styles.subtitle}>{view.subtitle}</Text> : null}
      {view.facts && view.facts.length > 0 ? (
        <View accessibilityLabel={t.t('deck.facts')}>
          {view.facts.map((fact) => (
            <View key={fact.label} style={styles.fact}>
              <Text style={styles.factLabel}>{fact.label}</Text>
              <Text style={styles.factValue}>
                {typeof fact.value === 'number' ? formatNumber(fact.value, t.locale) : fact.value}
                {fact.unit ? ` ${fact.unit}` : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {view.body ? <Text style={styles.body}>{view.body}</Text> : null}
      {view.tags && view.tags.length > 0 ? (
        <Text accessibilityLabel={t.t('deck.tags')} style={styles.tags}>
          {view.tags.join(' · ')}
        </Text>
      ) : null}
      {card.attribution ? <Text style={styles.attribution}>{card.attribution.text}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: 12 },
  card: { borderRadius: 16, padding: 16, backgroundColor: '#ffffff' },
  preview: { opacity: 0.4 },
  cover: { width: '100%', height: 180, borderRadius: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  subtitle: { fontSize: 16, opacity: 0.7 },
  body: { fontSize: 15, marginTop: 8 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  factLabel: { fontSize: 14, opacity: 0.7 },
  factValue: { fontSize: 14, fontWeight: '500' },
  tags: { fontSize: 13, marginTop: 8, opacity: 0.8 },
  attribution: { fontSize: 12, marginTop: 12, opacity: 0.6 },
  status: { fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#eef1f5',
  },
  buttonLabel: { fontSize: 15, fontWeight: '500' },
})
