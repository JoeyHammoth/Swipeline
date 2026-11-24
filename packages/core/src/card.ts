import { z } from 'zod'

/**
 * The normalized item shown on a card. Adapters produce Cards; UIs render them.
 *
 * The schema is structural on purpose: the `${sourceId}:${externalId}` id
 * convention is enforced by `isCardIdForSource` and the adapter testkit rather
 * than by a refinement, so this schema can be exported to clean JSON Schema.
 */
export const mediaSchema = z
  .object({
    kind: z.enum(['image', 'video']),
    url: z.url(),
    alt: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict()

export const factSchema = z
  .object({
    label: z.string().min(1),
    value: z.union([z.string(), z.number()]),
    unit: z.string().optional(),
  })
  .strict()

export const attributionSchema = z
  .object({
    text: z.string().min(1),
    url: z.url().optional(),
    required: z.boolean().optional(),
  })
  .strict()

export const cardSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    sourceId: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    body: z.string().optional(),
    media: z.array(mediaSchema).optional(),
    tags: z.array(z.string().min(1)).optional(),
    facts: z.array(factSchema).optional(),
    url: z.url().optional(),
    attribution: attributionSchema.optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
    /**
     * Filled by an Embedder. Numbers on the wire: a Float32Array would serialize
     * as `{"0": ...}` under JSON.stringify, so the rank package converts at the
     * computation boundary instead. Never serialized into a deck manifest.
     */
    embedding: z.array(z.number()).optional(),
    fetchedAt: z.iso.datetime(),
  })
  .strict()

export type Card = z.infer<typeof cardSchema>
export type CardMedia = z.infer<typeof mediaSchema>
export type CardFact = z.infer<typeof factSchema>
export type CardAttribution = z.infer<typeof attributionSchema>

/** Parses untrusted data into a Card, throwing a ZodError on failure. */
export function parseCard(input: unknown): Card {
  return cardSchema.parse(input)
}

/** Non-throwing variant for adapter `normalize` implementations. */
export function safeParseCard(input: unknown): ReturnType<typeof cardSchema.safeParse> {
  return cardSchema.safeParse(input)
}
