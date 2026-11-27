import { assertBindingConformance } from '@swipeline/binding-testkit'
import { createEngine } from '@swipeline/core'
import { SwipeDeck } from '@swipeline/svelte'
import { mount, unmount } from 'svelte'
import { createFixtureSource } from './fixture-source'
import './deck.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('The fixture markup is missing #root')

// Mounted on load, like the React fixture: the page has to be inspectable before
// (and whether or not) the conformance suite runs.
const store = createEngine({
  deckId: 'conformance',
  actor: 'reader',
  source: createFixtureSource(),
})
const container = document.createElement('div')
rootElement.append(container)
const instance = mount(SwipeDeck, {
  target: container,
  props: { store, label: 'Conformance deck' },
})
store.dispatch({ type: 'refill' })

window.__swipelineConformance = async () => {
  const root = container.firstElementChild
  if (!(root instanceof HTMLElement)) throw new Error('Svelte fixture rendered no deck element')
  return assertBindingConformance(
    {
      name: 'svelte',
      async mount() {
        return {
          root,
          settle: async () => {
            // Svelte flushes effects on a microtask; give it a tick before asking the
            // engine whether the engine itself settled.
            await new Promise((resolve) => setTimeout(resolve, 0))
            await store.whenSettled()
            await new Promise((resolve) => setTimeout(resolve, 0))
          },
          destroy: () => {
            unmount(instance)
            container.remove()
            store.close()
          },
        }
      },
    },
    { firstTitle: 'First card', secondTitle: 'Second card' },
  )
}
