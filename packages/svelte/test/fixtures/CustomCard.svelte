<script lang="ts">
  import type { DeckStore } from '@swipeline/core'
  import SwipeDeck from '../../src/SwipeDeck.svelte'

  let { store }: { store: DeckStore } = $props()
</script>

<SwipeDeck {store}>
  {#snippet card(card)}
    <span class="mine">{card.title}</span>
  {/snippet}
</SwipeDeck>
