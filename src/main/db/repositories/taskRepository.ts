import { getDb } from '../connection.js'
import type { CreateTaskInput, Priority, TaskRow, UpdateTaskInput } from '../schema.js'

function validateTitle(title: string): void {
  if (title.trim().length === 0) {
    throw new Error('Task title must not be empty')
  }
  if (title.trim().length > 200) {
    throw new Error('Task title must be 200 characters or fewer')
  }
}

function validateIsoDate(value: string | null | undefined, field: string): void {
  if (value === undefined || value === null || value === '') {
    return
  }
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    throw new Error(`${field} must be a valid ISO date string`)
  }
}

function normalizeCompleted(value: boolean): 0 | 1 {
  return value ? 1 : 0
}

function now(): string {
  return new Date().toISOString()
}

function getInsertedTask(id: number): TaskRow {
  const task = getTaskById(id)
  if (!task) {
    throw new Error('Task was not created')
  }
  return task
}

export function createTask(input: CreateTaskInput): TaskRow {
  validateTitle(input.title)
  validateIsoDate(input.due_date, 'Task due date')
  validateIsoDate(input.reminder_at, 'Task reminder date')

  const db = getDb()
  const list = db.prepare('SELECT id FROM lists WHERE id = ?').get(input.list_id)
  if (!list) {
    throw new Error(`List does not exist: ${input.list_id}`)
  }

  const maxSort = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS maxSortOrder FROM tasks WHERE list_id = ?')
    .get(input.list_id) as { maxSortOrder: number }
  const timestamp = now()
  const result = db
    .prepare(
      `INSERT INTO tasks (
        list_id, title, description, priority, due_date, reminder_at, completed, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      input.list_id,
      input.title.trim(),
      input.description ?? null,
      input.priority ?? 'medium',
      input.due_date ?? null,
      input.reminder_at ?? null,
      maxSort.maxSortOrder + 1,
      timestamp,
      timestamp,
    )

  return getInsertedTask(Number(result.lastInsertRowid))
}

export function getTaskById(id: number): TaskRow | undefined {
  return getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined
}

export function getTasksByListId(
  listId: number,
  options: { completed?: boolean; priority?: Priority; search?: string } = {},
): TaskRow[] {
  const conditions = ['list_id = ?']
  const params: unknown[] = [listId]

  if (options.completed !== undefined) {
    conditions.push('completed = ?')
    params.push(normalizeCompleted(options.completed))
  }
  if (options.priority) {
    conditions.push('priority = ?')
    params.push(options.priority)
  }
  if (options.search?.trim()) {
    conditions.push('(LOWER(title) LIKE LOWER(?) OR LOWER(COALESCE(description, \'\')) LIKE LOWER(?))')
    const query = `%${options.search.trim()}%`
    params.push(query, query)
  }

  return getDb()
    .prepare(`SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC, created_at ASC`)
    .all(...params) as TaskRow[]
}

export function updateTask(id: number, input: Partial<UpdateTaskInput>): TaskRow {
  if (input.title !== undefined) {
    validateTitle(input.title)
  }
  validateIsoDate(input.due_date, 'Task due date')
  validateIsoDate(input.reminder_at, 'Task reminder date')

  const fields: string[] = []
  const params: unknown[] = []

  if (input.title !== undefined) {
    fields.push('title = ?')
    params.push(input.title.trim())
  }
  if (input.description !== undefined) {
    fields.push('description = ?')
    params.push(input.description)
  }
  if (input.priority !== undefined) {
    fields.push('priority = ?')
    params.push(input.priority)
  }
  if (input.due_date !== undefined) {
    fields.push('due_date = ?')
    params.push(input.due_date)
  }
  if (input.reminder_at !== undefined) {
    fields.push('reminder_at = ?')
    params.push(input.reminder_at)
  }
  if (input.completed !== undefined) {
    fields.push('completed = ?')
    params.push(normalizeCompleted(input.completed))
  }
  if (input.sort_order !== undefined) {
    fields.push('sort_order = ?')
    params.push(input.sort_order)
  }

  const existing = getTaskById(id)
  if (!existing) {
    throw new Error(`Task does not exist: ${id}`)
  }

  if (fields.length > 0) {
    getDb()
      .prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`)
      .run(...params, id)
  }

  return getInsertedTask(id)
}

export function deleteTask(id: number): void {
  getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

export function searchTasks(
  query: string,
  filters: { listId?: number; completed?: boolean; priority?: Priority } = {},
): TaskRow[] {
  const conditions = ['(LOWER(title) LIKE LOWER(?) OR LOWER(COALESCE(description, \'\')) LIKE LOWER(?))']
  const params: unknown[] = [`%${query.trim()}%`, `%${query.trim()}%`]

  if (filters.listId !== undefined) {
    conditions.push('list_id = ?')
    params.push(filters.listId)
  }
  if (filters.completed !== undefined) {
    conditions.push('completed = ?')
    params.push(normalizeCompleted(filters.completed))
  }
  if (filters.priority) {
    conditions.push('priority = ?')
    params.push(filters.priority)
  }

  return getDb()
    .prepare(`SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC, created_at ASC`)
    .all(...params) as TaskRow[]
}

export function countTasksByList(listId: number): number {
  const row = getDb().prepare('SELECT COUNT(*) AS count FROM tasks WHERE list_id = ?').get(listId) as { count: number }
  return row.count
}

export function updateTaskSortOrder(listId: number, taskIds: number[]): void {
  const db = getDb()
  const transaction = db.transaction(() => {
    const uniqueIds = new Set(taskIds)
    if (uniqueIds.size !== taskIds.length) {
      throw new Error('Task sort order contains duplicate task ids')
    }

    const rows = db
      .prepare('SELECT id FROM tasks WHERE list_id = ? AND id IN (' + taskIds.map(() => '?').join(',') + ')')
      .all(listId, ...taskIds) as { id: number }[]
    if (rows.length !== taskIds.length) {
      throw new Error('All sorted tasks must belong to the requested list')
    }

    const update = db.prepare('UPDATE tasks SET sort_order = ? WHERE id = ? AND list_id = ?')
    taskIds.forEach((taskId, index) => {
      update.run(index, taskId, listId)
    })
  })

  if (taskIds.length === 0) {
    return
  }
  transaction()
}

export function getTasksWithPendingReminders(): TaskRow[] {
  return getDb()
    .prepare('SELECT * FROM tasks WHERE reminder_at IS NOT NULL AND completed = 0')
    .all() as TaskRow[]
}
