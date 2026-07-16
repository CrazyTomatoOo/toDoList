import type { Quadrant, Recurrence } from '../schema.js'
import { validateDateOnly } from '../../../shared/utils/dateValidator.js'

export function validateTitle(title: string): void {
  if (title.trim().length === 0) {
    throw new Error('Task title must not be empty')
  }
  if (title.trim().length > 200) {
    throw new Error('Task title must be 200 characters or fewer')
  }
}

export function validateIsoDate(value: string | null | undefined, field: string): void {
  if (value === undefined || value === null || value === '') {
    return
  }
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    throw new Error(`${field} must be a valid ISO date string`)
  }
}

export function validateRecurrence(value: Recurrence | null | undefined): void {
  if (value === undefined || value === null) {
    return
  }
  const valid: Recurrence[] = ['daily', 'weekly', 'monthly', 'yearly']
  if (!valid.includes(value)) {
    throw new Error(`Invalid recurrence: ${value}`)
  }
}

export function validateDateOrder(start: string | null | undefined, end: string | null | undefined): void {
  if (start && end && start > end) {
    throw new Error('Start date must be before or equal to end date')
  }
}

export function normalizeBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0
}

export function parseQuadrant(quadrant: Quadrant): { isUrgent: 0 | 1; isImportant: 0 | 1 } {
  switch (quadrant) {
    case 'q1-urgent-important':
      return { isUrgent: 1, isImportant: 1 }
    case 'q2-not-urgent-important':
      return { isUrgent: 0, isImportant: 1 }
    case 'q3-urgent-not-important':
      return { isUrgent: 1, isImportant: 0 }
    case 'q4-not-urgent-not-important':
      return { isUrgent: 0, isImportant: 0 }
    default:
      throw new Error(`Invalid quadrant: ${quadrant}`)
  }
}

export function validateTaskDates(
  input: {
    recurrence?: Recurrence | null
    recurrence_end_date?: string | null
    due_date?: string | null
    start_date?: string | null
    end_date?: string | null
  },
): void {
  validateRecurrence(input.recurrence)
  validateDateOnly(input.recurrence_end_date, 'Task recurrence end date')
  validateDateOnly(input.start_date, 'Task start date')
  validateDateOnly(input.end_date, 'Task end date')
  if (input.recurrence) {
    validateDateOnly(input.due_date, 'Task due date')
  }
  validateDateOrder(input.start_date, input.end_date)
}
