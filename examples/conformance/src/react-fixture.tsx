import { assertBindingConformance } from '@swipeline/binding-testkit'
import { createEngine } from '@swipeline/core'
import { SwipeDeck } from '@swipeline/react'
import '@swipeline/react/styles.css'
import { createRoot } from 'react-dom/client'
import { createFixtureSource } from './fixture-source'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('The fixture markup is missing #root')

const store = createEngine({
  deckId: 'conformance',
  actor: 'reader',
  source: createFixtureSource(),
})

const container = document.createElement('div')
rootElement.append(container)
const root = createRoot(container)
root.render(<SwipeDeck store={store} label="Conformance deck" />)
store.dispatch({ type: 'refill' })

window.__swipelineConformance = async () => {
  await store.whenSettled()
  const deck = container.firstElementChild
  if (!(deck instanceof HTMLElement)) throw new Error('React fixture rendered no deck element')
  return assertBindingConformance(
    {
      name: 'react',
      async mount() {
        return {
          root: deck,
          settle: async () => {
            // React flushes updates from a store change in a microtask; give it a tick
            // before asking the engine whether the work settled.
            await new Promise((resolve) => setTimeout(resolve, 0))
            await store.whenSettled()
          },
          destroy: () => {
            root.unmount()
            container.remove()
          },
        }
      },
    },
    { firstTitle: 'First card', secondTitle: 'Second card' },
  )
}
