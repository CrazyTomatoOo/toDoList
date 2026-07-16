import { getDb } from '../connection.js'
import type { Quadrant } from '../schema.js'
import type { TaskListOptions, TaskRow, TaskSearchFilters } from '../../../shared/ipc.js'
import { normalizeBoolean, parseQuadrant } from './taskValidation.js'

export function getTasksByListId(listId: number, options: TaskListOptions = {}): TaskRow[] {
  const conditions = ['list_id = ?']
  const params: unknown[] = [listId]

  if (options.completed !== undefined) {
    conditions.push('completed = ?')
    params.push(normalizeBoolean(options.completed))
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
  if (options.quadrant) {
    const { isUrgent, isImportant } = parseQuadrant(options.quadrant)
    conditions.push('is_urgent = ? AND is_important = ?')
    params.push(isUrgent, isImportant)
  }

  return getDb()
    .prepare(`SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC, created_at ASC`)
    .all(...params) as TaskRow[]
}
export function getTasksByQuadrant(listId: number, quadrant: Quadrant): TaskRow[] {
  return getTasksByListId(listId, { quadrant })
}


export function searchTasks(query: string, filters: TaskSearchFilters = {}): TaskRow[] {
  const conditions = ['(LOWER(title) LIKE LOWER(?) OR LOWER(COALESCE(description, \'\')) LIKE LOWER(?))']
  const params: unknown[] = [`%${query.trim()}%`, `%${query.trim()}%`]

  if (filters.listId !== undefined) {
    conditions.push('list_id = ?')
    params.push(filters.listId)
  }
  if (filters.completed !== undefined) {
    conditions.push('completed = ?')
    params.push(normalizeBoolean(filters.completed))
  }
  if (filters.priority) {
    conditions.push('priority = ?')
    params.push(filters.priority)
  }
  if (filters.recurrence !== undefined) {
    conditions.push('recurrence = ?')
    params.push(filters.recurrence)
  }
  if (filters.durationFilter) {
    switch (filters.durationFilter) {
      case 'all':
        break
      case 'hasDateRange':
        conditions.push('(start_date IS NOT NULL OR end_date IS NOT NULL)')
        break
      case 'noDateRange':
        conditions.push('start_date IS NULL AND end_date IS NULL')
        break
      default:
        throw new Error(`Invalid duration filter: ${filters.durationFilter}`)
    }
  }
  if (filters.quadrant) {
    const { isUrgent, isImportant } = parseQuadrant(filters.quadrant)
    conditions.push('is_urgent = ? AND is_important = ?')
    params.push(isUrgent, isImportant)
  }

  return getDb()
    .prepare(`SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY sort_order ASC, created_at ASC`)
    .all(...params) as TaskRow[]
}
