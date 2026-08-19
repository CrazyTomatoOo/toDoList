import type { Quadrant, Recurrence } from '../schema.js'
import { validateDateOnly } from '../../../shared/utils/dateValidator.js'

export function validateTitle(title: string): void {
  if (title.trim().length === 0) {
    throw new Error('任务标题不能为空')
  }
  if (title.trim().length > 200) {
    throw new Error('任务标题不能超过 200 个字符')
  }
}

export function validateIsoDate(value: string | null | undefined, field: string): void {
  if (value === undefined || value === null || value === '') {
    return
  }
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    throw new Error(`${field}必须为有效的 ISO 日期字符串`)
  }
}

export function validateRecurrence(value: Recurrence | null | undefined): void {
  if (value === undefined || value === null) {
    return
  }
  const valid: Recurrence[] = ['daily', 'weekly', 'monthly', 'yearly']
  if (!valid.includes(value)) {
    throw new Error(`无效的重复类型：${value}`)
  }
}

export function validateDateOrder(start: string | null | undefined, end: string | null | undefined): void {
  if (start && end && start > end) {
    throw new Error('开始日期不能晚于结束日期')
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
      throw new Error(`无效的象限：${quadrant}`)
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
  validateDateOnly(input.recurrence_end_date, '任务重复结束日期')
  validateDateOnly(input.start_date, '任务开始日期')
  validateDateOnly(input.end_date, '任务结束日期')
  if (input.recurrence) {
    validateDateOnly(input.due_date, '任务截止日期')
  }
  validateDateOrder(input.start_date, input.end_date)
}
