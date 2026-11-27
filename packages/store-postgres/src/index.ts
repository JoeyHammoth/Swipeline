import type {
  Card,
  EventQuery,
  EventStore,
  ItemStore,
  Profile,
  ProfileStore,
  SwipeEvent,
} from '@swipeline/core'

/** Bumped when the DDL below changes. */
const SCHEMA_VERSION = 1

const SCHEMA = `
create table if not exists events (
  id text primary key,
  actor text not null,
  deck_id text not null,
  card_id text not null,
  ts text not null,
  payload text not null
);
create index if not exists events_by_actor on events (actor, id);
create index if not exists events_by_deck on events (deck_id, id);
create table if not exists items (
  id text primary key,
  payload text not null
);
create table if not exists profiles (
  actor text not null,
  deck_id text not null,
  payload text not null,
  primary key (actor, deck_id)
);
`

/** The subset of `pg`'s client/pool that these stores use. */
export interface PostgresClient {
  query(text: string, values?: unknown[]): Promise<{ rows: readonly Record<string, unknown>[] }>
}

export interface PostgresStoreOptions {
  client: PostgresClient
}

export interface PostgresStores {
  events: EventStore
  items: ItemStore
  profiles: ProfileStore
  schemaVersion: number
}

function decode<T>(row: Record<string, unknown> | undefined): T | undefined {
  if (!row) return undefined
  return JSON.parse(String(row.payload)) as T
}

function eventFilter(query: EventQuery, start: number): { clause: string; params: string[] } {
  const clauses: string[] = []
  const params: string[] = []

  function add(column: string, operator: string, value: string): void {
    params.push(value)
    clauses.push(`${column} ${operator} $${start + params.length - 1}`)
  }

  if (query.actor !== undefined) add('actor', '=', query.actor)
  if (query.deckId !== undefined) add('deck_id', '=', query.deckId)
  if (query.cardId !== undefined) add('card_id', '=', query.cardId)
  // Text timestamps compare lexicographically, exactly as in the memory and
  // SQLite stores, so all three agree on the `since`/`until` boundary rules.
  if (query.since !== undefined) add('ts', '>=', query.since)
  if (query.until !== undefined) add('ts', '<', query.until)
  if (query.afterId !== undefined) add('id', '>', query.afterId)

  return { clause: clauses.length > 0 ? ` where ${clauses.join(' and ')}` : '', params }
}

/**
 * Postgres-backed stores over any `pg`-compatible client (a `Pool`, a `Client`,
 * or PGlite in tests). The tables are created on open, so an empty database is
 * all the setup a deployment needs.
 */
export async function createPostgresStores(options: PostgresStoreOptions): Promise<PostgresStores> {
  const { client } = options
  // One statement per call: a pg-compatible client may refuse a multi-statement
  // string (PGlite does), and separate calls make a partial failure obvious.
  for (const statement of SCHEMA.split(';')
    .map((part) => part.trim())
    .filter(Boolean)) {
    await client.query(statement)
  }

  async function selectEvents(query: EventQuery): Promise<readonly SwipeEvent[]> {
    const { clause, params } = eventFilter(query, 1)
    const limit = query.limit === undefined ? '' : ` limit $${params.length + 1}`
    const values = query.limit === undefined ? params : [...params, String(query.limit)]
    const result = await client.query(
      `select payload from events${clause} order by id${limit}`,
      values,
    )
    return result.rows.map((row) => decode<SwipeEvent>(row) as SwipeEvent)
  }

  const events: EventStore = {
    async append(batch: readonly SwipeEvent[]): Promise<void> {
      if (batch.length === 0) return
      await client.query('begin')
      try {
        for (const event of batch) {
          await client.query(
            'insert into events (id, actor, deck_id, card_id, ts, payload) values ($1, $2, $3, $4, $5, $6) on conflict (id) do nothing',
            [event.id, event.actor, event.deckId, event.cardId, event.ts, JSON.stringify(event)],
          )
        }
        await client.query('commit')
      } catch (cause) {
        await client.query('rollback')
        throw cause
      }
    },

    query: selectEvents,
    export: selectEvents,

    async erase(actor: string): Promise<number> {
      await client.query('begin')
      try {
        const counted = await client.query(
          'select count(*)::int as count from events where actor = $1',
          [actor],
        )
        const erased = Number(counted.rows[0]?.count ?? 0)
        await client.query('delete from events where actor = $1', [actor])
        await client.query('delete from profiles where actor = $1', [actor])
        await client.query('commit')
        return erased
      } catch (cause) {
        await client.query('rollback')
        throw cause
      }
    },
  }

  const items: ItemStore = {
    async get(id: string): Promise<Card | undefined> {
      const result = await client.query('select payload from items where id = $1', [id])
      return decode<Card>(result.rows[0])
    },

    async put(cards: readonly Card[]): Promise<void> {
      if (cards.length === 0) return
      await client.query('begin')
      try {
        for (const card of cards) {
          await client.query(
            'insert into items (id, payload) values ($1, $2) on conflict (id) do update set payload = excluded.payload',
            [card.id, JSON.stringify(card)],
          )
        }
        await client.query('commit')
      } catch (cause) {
        await client.query('rollback')
        throw cause
      }
    },

    async list(): Promise<readonly Card[]> {
      const result = await client.query('select payload from items order by id')
      return result.rows.map((row) => decode<Card>(row) as Card)
    },

    async delete(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return
      await client.query('delete from items where id = any($1)', [ids])
    },

    async clear(): Promise<void> {
      await client.query('delete from items')
    },
  }

  const profiles: ProfileStore = {
    async get(actor: string, deckId: string): Promise<Profile | undefined> {
      const result = await client.query(
        'select payload from profiles where actor = $1 and deck_id = $2',
        [actor, deckId],
      )
      return decode<Profile>(result.rows[0])
    },

    async put(profile: Profile): Promise<void> {
      await client.query(
        'insert into profiles (actor, deck_id, payload) values ($1, $2, $3) on conflict (actor, deck_id) do update set payload = excluded.payload',
        [profile.actor, profile.deckId, JSON.stringify(profile)],
      )
    },

    async delete(actor: string, deckId: string): Promise<void> {
      await client.query('delete from profiles where actor = $1 and deck_id = $2', [actor, deckId])
    },
  }

  return { events, items, profiles, schemaVersion: SCHEMA_VERSION }
}
