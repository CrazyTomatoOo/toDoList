import type { Priority, Recurrence, TaskRow } from '../schema.js'

export interface RecurringInstanceInput {
  list_id: number
  title: string
  description: string | null
  priority: Priority
  due_date: string
  recurrence: Recurrence
  recurrence_end_date: string | null
  start_date: string | null
  end_date: string | null
  is_urgent: 0 | 1
  is_important: 0 | 1
}

function parseDateOnly(dateStr: string): { year: number; month: number; day: number } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-')
  return {
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
  }
}

function formatDate(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`)
}

function computeNextDate(baseDate: string, recurrence: Recurrence): string {
  const { year, month, day } = parseDateOnly(baseDate)

  switch (recurrence) {
    case 'daily': {
      const date = new Date(year, month - 1, day)
      date.setDate(date.getDate() + 1)
      return formatDate(date)
    }
    case 'weekly': {
      const date = new Date(year, month - 1, day)
      date.setDate(date.getDate() + 7)
      return formatDate(date)
    }
    case 'monthly': {
      const targetMonth = month + 1
      const targetYear = year + Math.floor((targetMonth - 1) / 12)
      const normalizedMonth = ((targetMonth - 1) % 12 + 12) % 12 + 1
      const lastDay = new Date(targetYear, normalizedMonth, 0).getDate()
      const targetDay = Math.min(day, lastDay)
      return formatDate(new Date(targetYear, normalizedMonth - 1, targetDay))
    }
    case 'yearly': {
      const targetYear = year + 1
      const isLeap = new Date(targetYear, 1, 29).getMonth() === 1
      const targetDay = month === 2 && day === 29 && !isLeap ? 28 : day
      return formatDate(new Date(targetYear, month - 1, targetDay))
    }
    default: {
      return assertNever(recurrence)
    }
  }
}

export function generateNextRecurringInstance(existing: TaskRow): RecurringInstanceInput | undefined {
  if (!existing.recurrence) {
    return undefined
  }

  const baseDate = existing.due_date ?? existing.start_date
  if (!baseDate) {
    return undefined
  }

  const nextDueDate = computeNextDate(baseDate, existing.recurrence)

  if (existing.recurrence_end_date && nextDueDate > existing.recurrence_end_date) {
    return undefined
  }

  return {
    list_id: existing.list_id,
    title: existing.title,
    description: existing.description,
    priority: existing.priority,
    due_date: nextDueDate,
    recurrence: existing.recurrence,
    recurrence_end_date: existing.recurrence_end_date,
    start_date: existing.start_date ? computeNextDate(existing.start_date, existing.recurrence) : null,
    end_date: existing.end_date ? computeNextDate(existing.end_date, existing.recurrence) : null,
    is_urgent: existing.is_urgent,
    is_important: existing.is_important,
  }
}
