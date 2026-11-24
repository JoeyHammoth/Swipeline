import type { SwipeEvent } from './event.js'

/** Receives batches of committed events. Throwing asks the caller to retry. */
export interface Sink {
  id: string
  deliver(events: readonly SwipeEvent[]): Promise<void>
}

/**
 * Per-user gate on event recording. Returning `false` prevents both logging and
 * delivery. `undo` is always recorded, so the log stays coherent.
 */
export type ConsentPolicy = (event: SwipeEvent) => boolean | Promise<boolean>
