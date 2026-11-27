import { DatabaseSync } from 'node:sqlite'
import type {
  Card,
  EventQuery,
  EventStore,
  ItemStore,
  Profile,
  ProfileStore,
  SwipeEvent,
} from '@swipeline/core'

/** Bumped when the DDL below changes; recorded in `pragma user_version`. */
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

export interface SqliteStoreOptions {
  /** Database file, or `:memory:` for a throwaway one. */
  path: string
}

export interface SqliteStores {
  events: EventStore
  items: ItemStore
  profiles: ProfileStore
  /** Schema version recorded in the database, after migration. */
  schemaVersion: number
  /** Release the database handle. */
  close(): void
}

type Row = Record<string, unknown>

function decode<T>(row: Row | undefined): T | undefined {
  if (!row) return undefined
  return JSON.parse(String(row.payload)) as T
}

function encode(value: unknown): string {
  return JSON.stringify(value)
}

function eventFilter(query: EventQuery): { clause: string; params: (string | number)[] } {
  const clauses: string[] = []
  const params: (string | number)[] = []
  if (query.actor !== undefined) {
    clauses.push('actor = ?')
    params.push(query.actor)
  }
  if (query.deckId !== undefined) {
    clauses.push('deck_id = ?')
    params.push(query.deckId)
  }
  if (query.cardId !== undefined) {
    clauses.push('card_id = ?')
    params.push(query.cardId)
  }
  // ISO 8601 strings sort lexicographically, which is why `since` is inclusive
  // and `until` exclusive here as well as in the memory store.
  if (query.since !== undefined) {
    clauses.push('ts >= ?')
    params.push(query.since)
  }
  if (query.until !== undefined) {
    clauses.push('ts < ?')
    params.push(query.until)
  }
  if (query.afterId !== undefined) {
    clauses.push('id > ?')
    params.push(query.afterId)
  }
  return { clause: clauses.length > 0 ? ` where ${clauses.join(' and ')}` : '', params }
}

function selectEvents(db: DatabaseSync, query: EventQuery): readonly SwipeEvent[] {
  const { clause, params } = eventFilter(query)
  const limit = query.limit === undefined ? '' : ' limit ?'
  const statement = db.prepare(`select payload from events${clause} order by id${limit}`)
  const values = query.limit === undefined ? params : [...params, query.limit]
  return statement.all(...values).map((row) => decode<SwipeEvent>(row as Row) as SwipeEvent)
}

function readUserVersion(db: DatabaseSync): number {
  try {
    const row = db.prepare('select user_version as version from pragma_user_version').get()
    return Number(row?.version ?? 0)
  } catch {
    return 0
  }
}

export function createSqliteStores(options: SqliteStoreOptions): SqliteStores {
  const db = new DatabaseSync(options.path)
  db.exec('pragma busy_timeout = 5000')

  // Refuse a database written by a newer package rather than stamping it down
  // to this schema version and losing columns the next release added.
  const stored = readUserVersion(db)
  if (stored > SCHEMA_VERSION) {
    db.close()
    throw new Error(
      `database schema version ${stored} is newer than this package (${SCHEMA_VERSION})`,
    )
  }
  db.exec(SCHEMA)
  db.exec(`pragma user_version = ${SCHEMA_VERSION}`)

  function transaction<T>(body: () => T): T {
    db.exec('begin immediate')
    try {
      const value = body()
      db.exec('commit')
      return value
    } catch (cause) {
      db.exec('rollback')
      throw cause
    }
  }

  const events: EventStore = {
    async append(batch: readonly SwipeEvent[]): Promise<void> {
      if (batch.length === 0) return
      const insert = db.prepare(
        'insert into events (id, actor, deck_id, card_id, ts, payload) values (?, ?, ?, ?, ?, ?) on conflict(id) do nothing',
      )
      transaction(() => {
        for (const event of batch) {
          insert.run(event.id, event.actor, event.deckId, event.cardId, event.ts, encode(event))
        }
      })
    },

    async query(query: EventQuery): Promise<readonly SwipeEvent[]> {
      return selectEvents(db, query)
    },

    async export(query: EventQuery): Promise<readonly SwipeEvent[]> {
      return selectEvents(db, query)
    },

    async erase(actor: string): Promise<number> {
      return transaction(() => {
        const row = db.prepare('select count(*) as count from events where actor = ?').get(actor)
        const erased = Number(row?.count ?? 0)
        db.prepare('delete from events where actor = ?').run(actor)
        // Derived state must not outlive the events it was built from.
        db.prepare('delete from profiles where actor = ?').run(actor)
        return erased
      })
    },
  }

  const items: ItemStore = {
    async get(id: string): Promise<Card | undefined> {
      const row = db.prepare('select payload from items where id = ?').get(id)
      return decode<Card>(row as Row | undefined)
    },

    async put(cards: readonly Card[]): Promise<void> {
      if (cards.length === 0) return
      const upsert = db.prepare(
        'insert into items (id, payload) values (?, ?) on conflict(id) do update set payload = excluded.payload',
      )
      transaction(() => {
        for (const card of cards) upsert.run(card.id, encode(card))
      })
    },

    async list(): Promise<readonly Card[]> {
      return db
        .prepare('select payload from items order by id')
        .all()
        .map((row) => decode<Card>(row as Row) as Card)
    },

    async delete(ids: readonly string[]): Promise<void> {
      if (ids.length === 0) return
      const remove = db.prepare('delete from items where id = ?')
      transaction(() => {
        for (const id of ids) remove.run(id)
      })
    },

    async clear(): Promise<void> {
      db.exec('delete from items')
    },
  }

  const profiles: ProfileStore = {
    async get(actor: string, deckId: string): Promise<Profile | undefined> {
      const row = db
        .prepare('select payload from profiles where actor = ? and deck_id = ?')
        .get(actor, deckId)
      return decode<Profile>(row as Row | undefined)
    },

    async put(profile: Profile): Promise<void> {
      db.prepare(
        'insert into profiles (actor, deck_id, payload) values (?, ?, ?) on conflict(actor, deck_id) do update set payload = excluded.payload',
      ).run(profile.actor, profile.deckId, encode(profile))
    },

    async delete(actor: string, deckId: string): Promise<void> {
      db.prepare('delete from profiles where actor = ? and deck_id = ?').run(actor, deckId)
    },
  }

  return {
    events,
    items,
    profiles,
    schemaVersion: SCHEMA_VERSION,
    close(): void {
      db.close()
    },
  }
}
