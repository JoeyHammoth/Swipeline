type Segment =
  | { kind: 'property'; name: string }
  | { kind: 'index'; index: number }
  | { kind: 'slice'; end: number }

function parseSegment(segment: string): Segment[] | null {
  const head = /^[^[\]]*/.exec(segment)?.[0] ?? ''
  const segments: Segment[] = head ? [{ kind: 'property', name: head }] : []
  for (const match of segment.matchAll(/\[([^\]]*)\]/g)) {
    const spec = match[1] ?? ''
    if (spec.startsWith(':')) {
      const end = Number(spec.slice(1))
      if (!Number.isInteger(end) || end < 0) return null
      segments.push({ kind: 'slice', end })
    } else {
      const index = Number(spec)
      if (!Number.isInteger(index)) return null
      segments.push({ kind: 'index', index })
    }
  }
  return segments
}

function apply(current: unknown, segment: Segment): unknown {
  if (segment.kind === 'property') {
    if (current !== null && typeof current === 'object') {
      return (current as Record<string, unknown>)[segment.name]
    }
    return undefined
  }
  if (!Array.isArray(current) && typeof current !== 'string') return undefined
  if (segment.kind === 'index') {
    if (segment.index < 0) return undefined
    return current[segment.index]
  }
  return current.slice(0, segment.end)
}

/**
 * Reads a declarative field expression from a JSON value: `a.b`, `items[0]`,
 * `tags[:8]`, `authors[:3][0]`. Returns `undefined` for a missing path rather
 * than throwing, because a single bad row must not fail a whole page.
 */
export function readPath(input: unknown, expression: string): unknown {
  if (expression.trim() === '') return input
  let value: unknown = input
  for (const raw of expression.split('.')) {
    if (raw === '') continue
    const segments = parseSegment(raw)
    if (!segments) return undefined
    for (const segment of segments) {
      value = apply(value, segment)
      if (value === undefined) return undefined
    }
  }
  return value
}
