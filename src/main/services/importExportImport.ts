import type { ImportResult } from '../../shared/ipc.js'
import { createList, getAllLists } from '../db/repositories/listRepository.js'
import { validateDateOnly } from '../../shared/utils/dateValidator.js'
import { validateDateOrder } from '../db/repositories/taskValidation.js'
import { getDb } from '../db/connection.js'
import {
  assertNonEmptyString,
  assertOptionalDateOnly,
  assertOptionalIsoDate,
  assertOptionalRecurrence,
  assertPriority,
  assertTaskTitle,
  parseBoolean,
  parseCsv,
} from './importExportHelpers.js'

function now(): string {
  return new Date().toISOString()
}

export function importFromJson(jsonString: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(jsonString)
  } catch {
    throw new Error('Invalid JSON file')
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid JSON structure')
  }

  const payload = data as { lists?: unknown[]; tasks?: unknown[] }
  const lists = Array.isArray(payload.lists) ? payload.lists : []
  const tasks = Array.isArray(payload.tasks) ? payload.tasks : []

  return importData(lists, tasks)
}

export function importFromCsv(csvString: string): ImportResult {
  const rows = parseCsv(csvString)
  if (rows.length === 0) {
    return { importedLists: 0, importedTasks: 0 }
  }

  const header = rows[0]
  const requiredColumns = ['listName', 'title', 'priority']
  const missing = requiredColumns.filter((col) => !header.includes(col))
  if (missing.length > 0) {
    throw new Error(`Missing CSV columns: ${missing.join(', ')}`)
  }

  const tasks: unknown[] = []

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    if (cells.every((cell) => cell.trim() === '')) {
      continue
    }

    const row: Record<string, unknown> = {}
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = cells[j] ?? ''
    }

    tasks.push({
      listName: row.listName,
      title: row.title,
      description: row.description,
      priority: row.priority,
      dueDate: row.dueDate,
      reminderAt: row.reminderAt,
      completed: row.completed,
      sortOrder: row.sortOrder,
      recurrence: row.recurrence,
      recurrenceEndDate: row.recurrenceEndDate,
      startDate: row.startDate,
      endDate: row.endDate,
      isUrgent: row.isUrgent,
      isImportant: row.isImportant,
    })
  }

  return importData([], tasks)
}

function importData(listRows: unknown[], taskRows: unknown[]): ImportResult {
  const db = getDb()
  const existingLists = getAllLists()
  const existingByName = new Map(existingLists.map((list) => [list.name, list]))

  const transaction = db.transaction(() => {
    const nameToId = new Map<string, number>()
    for (const [name, list] of existingByName) {
      nameToId.set(name, list.id)
    }

    // Create lists declared in the JSON lists section.
    for (const row of listRows) {
      if (!row || typeof row !== 'object') {
        continue
      }
      const { name } = row as { name?: unknown }
      const listName = assertNonEmptyString(name, 'List name')
      if (!nameToId.has(listName)) {
        const created = createList(listName)
        nameToId.set(listName, created.id)
      }
    }

    const nextSortOrder = new Map<number, number>()
    const listMaxSort = db
      .prepare(
        'SELECT list_id, COALESCE(MAX(sort_order), -1) AS maxSort FROM tasks GROUP BY list_id',
      )
      .all() as Array<{ list_id: number; maxSort: number }>
    for (const { list_id, maxSort } of listMaxSort) {
      nextSortOrder.set(list_id, maxSort + 1)
    }

    const insertTask = db.prepare(
      `INSERT INTO tasks (
        list_id, title, description, priority, due_date, reminder_at, completed, sort_order,
        recurrence, recurrence_end_date, start_date, end_date, is_urgent, is_important,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )

    let importedTasks = 0

    for (const row of taskRows) {
      if (!row || typeof row !== 'object') {
        continue
      }
      const r = row as Record<string, unknown>

      const listName = assertNonEmptyString(r.listName, 'Task listName')
      const title = assertTaskTitle(r.title)
      const priority = assertPriority(r.priority)
      const description =
        r.description === undefined || r.description === null || r.description === ''
          ? null
          : String(r.description)
      const dueDate = assertOptionalIsoDate(r.dueDate, 'Task dueDate')
      const reminderAt = assertOptionalIsoDate(r.reminderAt, 'Task reminderAt')
      const recurrence = assertOptionalRecurrence(r.recurrence)
      const recurrenceEndDate = assertOptionalDateOnly(r.recurrenceEndDate, 'Task recurrenceEndDate')
      const startDate = assertOptionalDateOnly(r.startDate, 'Task startDate')
      const endDate = assertOptionalDateOnly(r.endDate, 'Task endDate')
      const isUrgent = parseBoolean(r.isUrgent)
      const isImportant = parseBoolean(r.isImportant)
      const completed =
        r.completed === true || r.completed === 'true' || r.completed === 1 ? 1 : 0

      validateDateOrder(startDate, endDate)
      if (recurrence) {
        validateDateOnly(dueDate, 'Task dueDate')
      }

      if (!nameToId.has(listName)) {
        const created = createList(listName)
        nameToId.set(listName, created.id)
      }
      const listId = nameToId.get(listName)!

      if (!nextSortOrder.has(listId)) {
        nextSortOrder.set(listId, 0)
      }
      const sortOrder = nextSortOrder.get(listId)!
      nextSortOrder.set(listId, sortOrder + 1)

      const timestamp = now()
      insertTask.run(
        listId,
        title,
        description,
        priority,
        dueDate,
        reminderAt,
        completed,
        sortOrder,
        recurrence,
        recurrenceEndDate,
        startDate,
        endDate,
        isUrgent ? 1 : 0,
        isImportant ? 1 : 0,
        timestamp,
        timestamp,
      )
      importedTasks++
    }

    const importedLists = nameToId.size - existingByName.size
    return { importedLists, importedTasks }
  })

  return transaction()
}
