import { SwipeDeck } from '@swipeline/react-native'
import { useEffect, useState } from 'react'
import { SafeAreaView, StyleSheet, Text, useColorScheme, View } from 'react-native'
import { createSmokeDeck } from './deck'
import { runScriptedSwipe, type SmokeResult } from './smoke'

export default function App() {
  const [deck] = useState(createSmokeDeck)
  const [smoke, setSmoke] = useState<SmokeResult>({ ok: false, detail: 'running…' })
  const scheme = useColorScheme()

  useEffect(() => {
    let cancelled = false
    runScriptedSwipe(deck)
      .then((result) => {
        if (cancelled) return
        setSmoke(result)
        // The iOS workflow reads this from the simulator log, where `console.log`
        // lands; the Android one greps the screen instead.
        console.log(`[swipeline-smoke] ${result.ok ? 'pass' : 'fail'}: ${result.detail}`)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setSmoke({ ok: false, detail: String(cause) })
        console.log(`[swipeline-smoke] fail: ${String(cause)}`)
      })
    return () => {
      cancelled = true
    }
  }, [deck])

  const dark = scheme === 'dark'

  return (
    <SafeAreaView style={[styles.root, dark ? styles.rootDark : styles.rootLight]}>
      <Text style={[styles.heading, dark ? styles.textDark : styles.textLight]}>
        Swipeline · Expo smoke
      </Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.smoke, smoke.ok ? styles.pass : styles.fail]}
      >
        {smoke.ok ? '✓ ' : '✗ '}
        {smoke.detail}
      </Text>
      <View style={styles.deck}>
        <SwipeDeck store={deck.store} label="Book deck" />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, gap: 8 },
  rootLight: { backgroundColor: '#f7f8fa' },
  rootDark: { backgroundColor: '#14171c' },
  heading: { fontSize: 18, fontWeight: '600' },
  textLight: { color: '#14171c' },
  textDark: { color: '#f7f8fa' },
  smoke: { fontSize: 14 },
  pass: { color: '#1f7a4c' },
  fail: { color: '#a52020' },
  deck: { flex: 1 },
})
