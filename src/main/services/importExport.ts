import { getDb } from '../db/connection.js'
import { createList, getAllLists } from '../db/repositories/listRepository.js'
import type { Priority } from '../../shared/ipc.js'
import type { ImportResult } from '../../shared/ipc.js'
import type { TaskRow } from '../db/schema.js'

export interface JsonExportList {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface JsonExportTask {
  listName: string
  title: string
  description: string | null
  priority: Priority
  dueDate: string | null
  reminderAt: string | null
  completed: boolean
  sortOrder: number
}

export interface JsonExport {
  lists: JsonExportList[]
  tasks: JsonExportTask[]
}

const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low']

function assertPriority(value: unknown): Priority {
  if (typeof value !== 'string' || !VALID_PRIORITIES.includes(value as Priority)) {
    throw new Error(`Invalid priority: ${value}`)
  }
  return value as Priority
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function assertTaskTitle(value: unknown): string {
  const title = assertNonEmptyString(value, 'Task title')
  if (title.length > 200) {
    throw new Error('Task title must be 200 characters or fewer')
  }
  return title
}

function assertOptionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const date = String(value)
  if (Number.isNaN(Date.parse(date))) {
    throw new Error(`${field} must be a valid ISO date string`)
  }
  return date
}

function now(): string {
  return new Date().toISOString()
}

export function exportToJson(): string {
  const db = getDb()
  const lists = getAllLists().map((list) => ({
    id: list.id,
    name: list.name,
    createdAt: list.created_at,
    updatedAt: list.updated_at,
  }))

  const tasks = db
    .prepare(
      `SELECT tasks.*, lists.name AS list_name
       FROM tasks
       JOIN lists ON lists.id = tasks.list_id
       ORDER BY tasks.sort_order ASC, tasks.created_at ASC`,
    )
    .all() as Array<TaskRow & { list_name: string }>

  const exportTasks: JsonExportTask[] = tasks.map((task) => ({
    listName: task.list_name,
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.due_date,
    reminderAt: task.reminder_at,
    completed: task.completed === 1,
    sortOrder: task.sort_order,
  }))

  return JSON.stringify({ lists, tasks: exportTasks } as JsonExport, null, 2)
}

export function exportToCsv(): string {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT lists.name AS listName,
              tasks.title,
              tasks.description,
              tasks.priority,
              tasks.due_date AS dueDate,
              tasks.reminder_at AS reminderAt,
              tasks.completed,
              tasks.sort_order AS sortOrder
       FROM tasks
       JOIN lists ON lists.id = tasks.list_id
       ORDER BY tasks.sort_order ASC, tasks.created_at ASC`,
    )
    .all() as Array<{
      listName: string
      title: string
      description: string | null
      priority: Priority
      dueDate: string | null
      reminderAt: string | null
      completed: 0 | 1
      sortOrder: number
    }>

  const lines: string[] = [
    'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder',
  ]
  for (const row of rows) {
    const fields = [
      escapeCsv(row.listName),
      escapeCsv(row.title),
      escapeCsv(row.description ?? ''),
      escapeCsv(row.priority),
      escapeCsv(row.dueDate ?? ''),
      escapeCsv(row.reminderAt ?? ''),
      row.completed ? 'true' : 'false',
      String(row.sortOrder),
    ]
    lines.push(fields.join(','))
  }
  return lines.join('\n')
}

function escapeCsv(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
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
    })
  }

  return importData([], tasks)
}

function parseCsv(csvString: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i]
    const nextChar = csvString[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        row.push(field)
        field = ''
      } else if (char === '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      } else if (char === '\r') {
        // Carriage return is handled together with the following newline.
        // If it appears on its own (rare), treat it as part of the field.
        if (nextChar !== '\n') {
          field += char
        }
      } else {
        field += char
      }
    }
  }

  if (row.length > 0 || field.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
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
        list_id, title, description, priority, due_date, reminder_at, completed, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      const completed =
        r.completed === true || r.completed === 'true' || r.completed === 1 ? 1 : 0

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
