import { getDb } from '../connection.js'
import type { ListRow } from '../schema.js'

export type ListWithTaskCount = ListRow & { totalCount: number; completedCount: number }

function validateName(name: string): void {
  if (name.trim().length === 0) {
    throw new Error('List name must not be empty')
  }
}

function now(): string {
  return new Date().toISOString()
}

function rejectDuplicateName(name: string, exceptId?: number): void {
  const row = getDb()
    .prepare(exceptId === undefined ? 'SELECT id FROM lists WHERE name = ?' : 'SELECT id FROM lists WHERE name = ? AND id != ?')
    .get(...(exceptId === undefined ? [name.trim()] : [name.trim(), exceptId])) as { id: number } | undefined

  if (row) {
    throw new Error(`List name already exists: ${name.trim()}`)
  }
}

function getExistingList(id: number): ListRow {
  const list = getListById(id)
  if (!list) {
    throw new Error(`List does not exist: ${id}`)
  }
  return list
}

export function createList(name: string): ListRow {
  validateName(name)
  rejectDuplicateName(name)

  const timestamp = now()
  const result = getDb()
    .prepare('INSERT INTO lists (name, created_at, updated_at) VALUES (?, ?, ?)')
    .run(name.trim(), timestamp, timestamp)

  return getExistingList(Number(result.lastInsertRowid))
}

export function getListById(id: number): ListRow | undefined {
  return getDb().prepare('SELECT * FROM lists WHERE id = ?').get(id) as ListRow | undefined
}

export function getAllLists(): ListRow[] {
  return getDb().prepare('SELECT * FROM lists ORDER BY created_at ASC').all() as ListRow[]
}

export function getListsWithTaskCount(): ListWithTaskCount[] {
  return getDb()
    .prepare(
      `SELECT
        lists.*,
        COUNT(tasks.id) AS totalCount,
        COALESCE(SUM(CASE WHEN tasks.completed = 1 THEN 1 ELSE 0 END), 0) AS completedCount
      FROM lists
      LEFT JOIN tasks ON tasks.list_id = lists.id
      GROUP BY lists.id
      ORDER BY lists.created_at ASC`,
    )
    .all() as ListWithTaskCount[]
}

export function updateList(id: number, name: string): ListRow {
  validateName(name)
  getExistingList(id)
  rejectDuplicateName(name, id)

  getDb().prepare('UPDATE lists SET name = ? WHERE id = ?').run(name.trim(), id)
  return getExistingList(id)
}

export function deleteList(id: number): void {
  getDb().prepare('DELETE FROM lists WHERE id = ?').run(id)
}
