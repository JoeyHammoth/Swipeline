import { describe, expect, it } from 'vitest'
import {
  type Card,
  cardId,
  cardSchema,
  isCardIdForSource,
  parseCard,
  parseCardId,
  safeParseCard,
} from '../src/index.js'

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    schemaVersion: 1,
    id: 'test:1',
    sourceId: 'test',
    title: 'A card',
    fetchedAt: '2026-11-24T10:00:00.000Z',
    ...overrides,
  }
}

describe('card id convention', () => {
  it('namespaces ids by source', () => {
    expect(cardId('arxiv', '2401.00001')).toBe('arxiv:2401.00001')
  })

  it('rejects empty parts', () => {
    expect(() => cardId('', 'x')).toThrow(TypeError)
    expect(() => cardId('x', '')).toThrow(TypeError)
  })

  it('round-trips through parseCardId', () => {
    expect(parseCardId('openlibrary:OL123W')).toEqual({
      sourceId: 'openlibrary',
      externalId: 'OL123W',
    })
  })

  it('returns null for malformed ids', () => {
    expect(parseCardId('no-separator')).toBeNull()
    expect(parseCardId(':missing-source')).toBeNull()
    expect(parseCardId('missing-external:')).toBeNull()
  })

  it('recognizes ids belonging to a source', () => {
    expect(isCardIdForSource('arxiv:2401.00001', 'arxiv')).toBe(true)
    expect(isCardIdForSource('arxiv:', 'arxiv')).toBe(false)
    expect(isCardIdForSource('arxivx:1', 'arxiv')).toBe(false)
  })
})

describe('cardSchema', () => {
  it('accepts a minimal card', () => {
    expect(parseCard(makeCard()).title).toBe('A card')
  })

  it('accepts a full card', () => {
    const card = makeCard({
      subtitle: 'An author',
      body: 'A description',
      media: [{ kind: 'image', url: 'https://example.com/a.jpg', alt: 'cover', width: 300 }],
      tags: ['space opera', 'fiction'],
      facts: [
        { label: 'Price', value: 12.5, unit: 'USD' },
        { label: 'Rating', value: '4.6' },
      ],
      url: 'https://example.com/item',
      attribution: { text: 'Data from Example', url: 'https://example.com', required: true },
      extra: { raw: { anything: true } },
    })
    expect(cardSchema.parse(card)).toEqual(card)
  })

  it('requires a title', () => {
    const { title: _title, ...withoutTitle } = makeCard()
    expect(safeParseCard(withoutTitle).success).toBe(false)
  })

  it('rejects unversioned or future-version cards', () => {
    expect(safeParseCard({ ...makeCard(), schemaVersion: 2 }).success).toBe(false)
  })

  it('rejects unknown top-level fields so adapters use `extra`', () => {
    expect(safeParseCard({ ...makeCard(), colour: 'red' }).success).toBe(false)
  })

  it('rejects malformed media and urls', () => {
    expect(safeParseCard({ ...makeCard(), media: [{ kind: 'audio', url: 'x' }] }).success).toBe(
      false,
    )
    expect(safeParseCard({ ...makeCard(), url: 'not-a-url' }).success).toBe(false)
  })

  it('requires an ISO 8601 fetch timestamp', () => {
    expect(safeParseCard({ ...makeCard(), fetchedAt: 'yesterday' }).success).toBe(false)
  })

  it('accepts a numeric embedding and rejects a Float32Array on the wire', () => {
    expect(safeParseCard({ ...makeCard(), embedding: [0.1, 0.2] }).success).toBe(true)
    expect(safeParseCard({ ...makeCard(), embedding: new Float32Array([0.1, 0.2]) }).success).toBe(
      false,
    )
  })
})
