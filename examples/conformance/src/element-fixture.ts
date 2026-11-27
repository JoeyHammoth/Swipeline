import { assertBindingConformance } from '@swipeline/binding-testkit'
import { createEngine } from '@swipeline/core'
import { SwipeDeckElement } from '@swipeline/element'
import { createFixtureSource } from './fixture-source'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('The fixture markup is missing #root')

// Mounted on load, like the React fixture: the page has to be inspectable before
// (and whether or not) the conformance suite runs.
const store = createEngine({
  deckId: 'conformance',
  actor: 'reader',
  source: createFixtureSource(),
})
const element = new SwipeDeckElement()
element.store = store
rootElement.append(element)
store.dispatch({ type: 'refill' })

window.__swipelineConformance = async () =>
  assertBindingConformance(
    {
      name: 'element',
      async mount() {
        return {
          root: element,
          settle: async () => {
            await store.whenSettled()
            await new Promise((resolve) => setTimeout(resolve, 0))
          },
          destroy: () => {
            element.remove()
            store.close()
          },
        }
      },
    },
    { firstTitle: 'First card', secondTitle: 'Second card' },
  )
