import type { Quadrant, Recurrence, ReminderRecurrence } from '../schema.js'
import { validateDateOnly } from '../../../shared/utils/dateValidator.js'
import { VALID_REMINDER_RECURRENCES } from './reminderSchedule.js'

export function validateTitle(title: string): void {
  if (title.trim().length === 0) {
    throw new Error('任务标题不能为空')
  }
  if (title.trim().length > 200) {
    throw new Error('任务标题不能超过 200 个字符')
  }
}

export function validateIsoDate(
  value: string | null | undefined,
  field: string,
): void {
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

export function validateDateOrder(
  start: string | null | undefined,
  end: string | null | undefined,
): void {
  if (start && end && start > end) {
    throw new Error('开始日期不能晚于结束日期')
  }
}

export function normalizeBoolean(value: boolean): 0 | 1 {
  return value ? 1 : 0
}

export function parseQuadrant(quadrant: Quadrant): {
  isUrgent: 0 | 1
  isImportant: 0 | 1
} {
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

export function validateTaskDates(input: {
  recurrence?: Recurrence | null
  recurrence_end_date?: string | null
  due_date?: string | null
  start_date?: string | null
  end_date?: string | null
}): void {
  validateRecurrence(input.recurrence)
  validateDateOnly(input.recurrence_end_date, '任务重复结束日期')
  validateDateOnly(input.start_date, '任务开始日期')
  validateDateOnly(input.end_date, '任务结束日期')
  if (input.recurrence) {
    validateDateOnly(input.due_date, '任务截止日期')
  }
  validateDateOrder(input.start_date, input.end_date)
}

/**
 * Extracts the literal `HH:MM` of a reminder datetime. Uses string extraction
 * (not Date arithmetic) so the time-of-day is exactly what the user typed,
 * independent of timezone interpretation of the stored string.
 */
export function deriveReminderTime(reminderAt: string): string | null {
  const match = /T(\d{2}):(\d{2})/.exec(reminderAt)
  if (!match) return null
  return `${match[1]}:${match[2]}`
}

export function validateReminderRecurrence(
  value: ReminderRecurrence | null | undefined,
): void {
  if (value === undefined || value === null) {
    return
  }
  if (!VALID_REMINDER_RECURRENCES.includes(value)) {
    throw new Error(`无效的提醒重复类型：${value}`)
  }
}

export function validateReminderInterval(
  value: number | null | undefined,
): void {
  if (value === undefined || value === null) {
    return
  }
  if (!Number.isInteger(value) || value < 1 || value > 365) {
    throw new Error('每 N 天提醒需要设置有效的间隔天数（1-365）')
  }
}

export function validateReminderTime(value: string | null | undefined): void {
  if (value === undefined || value === null || value === '') {
    return
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error('提醒时刻必须为有效的 HH:MM 格式')
  }
}

/**
 * Validates and normalizes the reminder-rule fields of an incoming task payload.
 * `everyN` requires an interval; other cadences drop it; the rule's trigger
 * time-of-day is derived from `reminder_at` so the rule owns its trigger time
 * and `reminder_at` stays pure next-fire state (ADR-0001).
 */
export function normalizeReminderRule(input: {
  reminder_recurrence?: ReminderRecurrence | null
  reminder_interval?: number | null
  reminder_at?: string | null
}): {
  reminder_recurrence: ReminderRecurrence
  reminder_interval: number | null
  reminder_time: string | null
} {
  const recurrence = input.reminder_recurrence ?? 'once'
  validateReminderRecurrence(recurrence)
  const interval =
    recurrence === 'everyN' ? (input.reminder_interval ?? null) : null
  if (
    recurrence === 'everyN' &&
    (interval === null || interval < 1 || !Number.isInteger(interval))
  ) {
    throw new Error('每 N 天提醒需要设置有效的间隔天数（1-365）')
  }
  const time =
    recurrence === 'once' || !input.reminder_at
      ? null
      : deriveReminderTime(input.reminder_at)
  validateReminderTime(time)
  return {
    reminder_recurrence: recurrence,
    reminder_interval: interval,
    reminder_time: time,
  }
}

/**
 * Validates the reminder boundary: a static end date must be a valid date-only
 * string, and a follow-duration rule requires the task to have an end date
 * (the UI disables the option until a duration is configured).
 */
export function validateReminderBoundary(input: {
  reminder_end_date?: string | null
  reminder_follow_duration?: boolean
  end_date?: string | null
}): void {
  validateDateOnly(input.reminder_end_date, '提醒结束日期')
  if (input.reminder_follow_duration === true && !input.end_date) {
    throw new Error('跟随持续期的提醒需要任务设置结束日期')
  }
}
