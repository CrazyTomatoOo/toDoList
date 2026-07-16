import { validateDateOnly } from '../../shared/utils/dateValidator.js'
import type { Priority, Recurrence } from '../../shared/ipc.js'
import { normalizeBoolean, validateRecurrence } from '../db/repositories/taskValidation.js'

export const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low']

export function assertPriority(value: unknown): Priority {
  if (typeof value !== 'string' || !VALID_PRIORITIES.includes(value as Priority)) {
    throw new Error(`Invalid priority: ${value}`)
  }
  return value as Priority
}

export function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  return value.trim()
}

export function assertTaskTitle(value: unknown): string {
  const title = assertNonEmptyString(value, 'Task title')
  if (title.length > 200) {
    throw new Error('Task title must be 200 characters or fewer')
  }
  return title
}

export function assertOptionalIsoDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const date = String(value)
  if (Number.isNaN(Date.parse(date))) {
    throw new Error(`${field} must be a valid ISO date string`)
  }
  return date
}

export function assertOptionalDateOnly(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const date = String(value)
  validateDateOnly(date, field)
  return date
}

export function assertOptionalRecurrence(value: unknown): Recurrence | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const recurrence = String(value) as Recurrence
  validateRecurrence(recurrence)
  return recurrence
}

export function parseBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export function escapeCsv(value: string): string {
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

export function parseCsv(csvString: string): string[][] {
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

export function normalizeTaskBoolean(value: unknown): 0 | 1 {
  return normalizeBoolean(parseBoolean(value))
}
