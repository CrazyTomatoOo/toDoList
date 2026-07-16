import { getDb } from '../db/connection.js'
import { getAllLists } from '../db/repositories/listRepository.js'
import type { Priority, Recurrence } from '../../shared/ipc.js'
import type { ImportResult } from '../../shared/ipc.js'
import type { TaskRow } from '../db/schema.js'
import { escapeCsv } from './importExportHelpers.js'
export { importFromCsv, importFromJson } from './importExportImport.js'

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
  recurrence: Recurrence | null
  recurrenceEndDate: string | null
  startDate: string | null
  endDate: string | null
  isUrgent: boolean
  isImportant: boolean
}

export interface JsonExport {
  lists: JsonExportList[]
  tasks: JsonExportTask[]
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
    recurrence: task.recurrence,
    recurrenceEndDate: task.recurrence_end_date,
    startDate: task.start_date,
    endDate: task.end_date,
    isUrgent: task.is_urgent === 1,
    isImportant: task.is_important === 1,
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
              tasks.sort_order AS sortOrder,
              tasks.recurrence,
              tasks.recurrence_end_date AS recurrenceEndDate,
              tasks.start_date AS startDate,
              tasks.end_date AS endDate,
              tasks.is_urgent AS isUrgent,
              tasks.is_important AS isImportant
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
      recurrence: Recurrence | null
      recurrenceEndDate: string | null
      startDate: string | null
      endDate: string | null
      isUrgent: 0 | 1
      isImportant: 0 | 1
    }>

  const lines: string[] = [
    'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder,recurrence,recurrenceEndDate,startDate,endDate,isUrgent,isImportant',
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
      escapeCsv(row.recurrence ?? ''),
      escapeCsv(row.recurrenceEndDate ?? ''),
      escapeCsv(row.startDate ?? ''),
      escapeCsv(row.endDate ?? ''),
      row.isUrgent ? 'true' : 'false',
      row.isImportant ? 'true' : 'false',
    ]
    lines.push(fields.join(','))
  }
  return lines.join('\n')
}

export type { ImportResult }
