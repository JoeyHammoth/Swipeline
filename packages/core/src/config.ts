import { z } from 'zod'
import { swipeActionSchema } from './event.js'

/**
 * A deck can be described as data instead of code: `*.deck.json` holds the
 * manifest, and the CLI turns it into an adapter, a store and a server without
 * executing anything from the file. Only the declarative HTTP/JSON source is
 * expressible this way; a hand-written adapter stays code.
 */
export const deckManifestSourceSchema = z
  .object({
    type: z.literal('http-json'),
    id: z.string().min(1),
    url: z.url(),
    /** Expression for the array of rows; defaults to the response itself. */
    itemsPath: z.string().min(1).optional(),
    map: z
      .object({
        id: z.string().min(1),
        title: z.string().min(1),
        subtitle: z.string().min(1).optional(),
        body: z.string().min(1).optional(),
        tags: z.string().min(1).optional(),
        url: z.string().min(1).optional(),
        media: z.string().min(1).optional(),
        facts: z.string().min(1).optional(),
        extra: z.string().min(1).optional(),
      })
      .strict(),
    pagination: z
      .object({
        type: z.enum(['page', 'offset', 'cursor', 'none']).optional(),
        param: z.string().min(1).optional(),
        pageSize: z.number().int().positive().max(200).optional(),
        start: z.number().int().min(0).optional(),
        nextPath: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    attribution: z
      .object({ text: z.string().min(1), url: z.url() })
      .strict()
      .optional(),
    /** Query parameter for search, or `false` to disable it. Defaults to `q`. */
    queryParam: z.union([z.string().min(1), z.literal(false)]).optional(),
    filters: z.array(z.string().min(1)).optional(),
  })
  .strict()

export const deckManifestSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9][a-z0-9-]*$/, 'use lower-case letters, digits and dashes'),
    /** Local actor used by the CLI playground. Defaults to `local`. */
    actor: z.string().min(1).optional(),
    source: deckManifestSourceSchema,
    actions: z
      .object({
        right: swipeActionSchema.optional(),
        left: swipeActionSchema.optional(),
        up: swipeActionSchema.optional(),
        down: swipeActionSchema.optional(),
      })
      .strict()
      .optional(),
    prefetch: z
      .object({
        buffer: z.number().int().positive().max(200),
        refillAt: z.number().int().min(0).max(200),
      })
      .strict()
      .optional(),
    undoDepth: z.number().int().min(0).max(50).optional(),
    template: z.enum(['text', 'media', 'facts', 'compare']).optional(),
  })
  .strict()

export type DeckManifestSource = z.infer<typeof deckManifestSourceSchema>
export type DeckManifest = z.infer<typeof deckManifestSchema>

/**
 * Parses untrusted JSON into a manifest, throwing a `ZodError` on failure. Every
 * object is strict, so a typo is an error rather than a silently ignored key.
 */
export function parseDeckManifest(input: unknown): DeckManifest {
  return deckManifestSchema.parse(input)
}

/** Identity helper for a manifest written in TypeScript, validated at startup. */
export function defineDeck(manifest: DeckManifest): DeckManifest {
  return parseDeckManifest(manifest)
}
