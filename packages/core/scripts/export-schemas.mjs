/**
 * Exports the core schemas as JSON Schema so non-JavaScript clients and editors
 * can validate the same Card, SwipeEvent and Profile shapes. Zod is the single
 * source of truth (ADR-0002). Run from packages/core after a build.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { cardSchema, profileSchema, swipeEventSchema } from '../dist/index.js'

const OUT_DIR = new URL('../../../docs/public/schemas/', import.meta.url).pathname
mkdirSync(OUT_DIR, { recursive: true })

const schemas = [
  ['card.schema.json', 'Swipeline Card', cardSchema],
  ['swipe-event.schema.json', 'Swipeline SwipeEvent', swipeEventSchema],
  ['profile.schema.json', 'Swipeline Profile', profileSchema],
]

for (const [file, title, schema] of schemas) {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' })
  const output = { $id: `https://swipeline.dev/schemas/${file}`, title, ...jsonSchema }
  writeFileSync(`${OUT_DIR}${file}`, `${JSON.stringify(output, null, 2)}\n`)
  console.log(`wrote docs/public/schemas/${file}`)
}
