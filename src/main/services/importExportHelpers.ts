import { validateDateOnly } from '../../shared/utils/dateValidator.js'
import type {
  Priority,
  Recurrence,
  ReminderRecurrence,
} from '../../shared/ipc.js'
import {
  normalizeBoolean,
  validateRecurrence,
  validateReminderRecurrence,
} from '../db/repositories/taskValidation.js'

export const VALID_PRIORITIES: Priority[] = ['high', 'medium', 'low']

export function assertPriority(value: unknown): Priority {
  if (
    typeof value !== 'string' ||
    !VALID_PRIORITIES.includes(value as Priority)
  ) {
    throw new Error(`无效的优先级：${value}`)
  }
  return value as Priority
}

export function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field}不能为空字符串`)
  }
  return value.trim()
}

export function assertTaskTitle(value: unknown): string {
  const title = assertNonEmptyString(value, '任务标题')
  if (title.length > 200) {
    throw new Error('任务标题不能超过 200 个字符')
  }
  return title
}

export function assertOptionalIsoDate(
  value: unknown,
  field: string,
): string | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const date = String(value)
  if (Number.isNaN(Date.parse(date))) {
    throw new Error(`${field}必须为有效的 ISO 日期字符串`)
  }
  return date
}

export function assertOptionalDateOnly(
  value: unknown,
  field: string,
): string | null {
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

export function assertOptionalReminderRecurrence(
  value: unknown,
): ReminderRecurrence | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const recurrence = String(value) as ReminderRecurrence
  validateReminderRecurrence(recurrence)
  return recurrence
}

export function parseReminderInterval(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > 365) {
    throw new Error('提醒间隔必须为 1-365 的整数')
  }
  return n
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
