import { assertBindingConformance } from '@swipeline/binding-testkit'
import { createEngine } from '@swipeline/core'
import { SwipeDeck } from '@swipeline/vue'
import { createApp } from 'vue'
import { createFixtureSource } from './fixture-source'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('The fixture markup is missing #root')

window.__swipelineConformance = async () =>
  assertBindingConformance(
    {
      name: 'vue',
      async mount() {
        const store = createEngine({
          deckId: 'conformance',
          actor: 'reader',
          source: createFixtureSource(),
        })
        const container = document.createElement('div')
        rootElement.append(container)
        const app = createApp(SwipeDeck, { store, label: 'Conformance deck' })
        app.mount(container)
        store.dispatch({ type: 'refill' })

        const root = container.firstElementChild
        if (!(root instanceof HTMLElement)) throw new Error('Vue fixture rendered no deck element')

        return {
          root,
          settle: async () => {
            // Vue flushes rendering on a microtask; give it a tick before asking the
            // engine whether its own work settled.
            await new Promise((resolve) => setTimeout(resolve, 0))
            await store.whenSettled()
            await new Promise((resolve) => setTimeout(resolve, 0))
          },
          destroy: () => {
            app.unmount()
            container.remove()
            store.close()
          },
        }
      },
    },
    { firstTitle: 'First card', secondTitle: 'Second card' },
  )
