import type { ReminderRecurrence, TaskRow } from '../schema.js'

/**
 * Repeating-reminder cadence math (ADR-0001). Independent from task recurrence
 * (taskRecurrence.ts): reminder rules repeat on their own cadence, anchored on
 * the task's materialized `reminder_at` next-fire time, and never follow task
 * instances.
 */

export const VALID_REMINDER_RECURRENCES: ReminderRecurrence[] = [
  'once',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'everyN',
]

function parseDateOnly(dateStr: string): {
  year: number
  month: number
  day: number
} {
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

function advanceDate(
  baseDate: string,
  recurrence: ReminderRecurrence,
  interval: number | null,
): string {
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
      const normalizedMonth = ((((targetMonth - 1) % 12) + 12) % 12) + 1
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
    case 'everyN': {
      if (interval === null || interval < 1) {
        throw new Error('每 N 天提醒需要设置有效的间隔天数（1-365）')
      }
      const date = new Date(year, month - 1, day)
      date.setDate(date.getDate() + interval)
      return formatDate(date)
    }
    case 'once': {
      // Guarded at the call site; kept for switch exhaustiveness.
      throw new Error('一次性提醒没有下一次触发时间')
    }
    default: {
      return assertNever(recurrence)
    }
  }
}

/** The rule's last allowed fire day, inclusive; null means unbounded. */
function boundaryEndDay(task: TaskRow): string | null {
  if (task.reminder_follow_duration === 1) {
    // Dynamic boundary: follow the task's duration window (future edits propagate).
    return task.end_date
  }
  return task.reminder_end_date
}

/**
 * Whether the reminder currently stored in `task.reminder_at` should produce a
 * notification when it comes due — i.e. its fire day is still inside the rule's
 * boundary. Out-of-window fires are silently advanced instead of notifying.
 */
export function shouldFireReminder(task: TaskRow): boolean {
  if (!task.reminder_at) return false
  const fireDay = task.reminder_at.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fireDay)) return true

  if (task.reminder_follow_duration === 1) {
    if (!task.end_date) return false
    if (task.start_date && fireDay < task.start_date) return false
    return fireDay <= task.end_date
  }
  if (task.reminder_end_date) {
    return fireDay <= task.reminder_end_date
  }
  return true
}

/**
 * After the reminder in `task.reminder_at` fires, compute the next fire time.
 *
 * All intermediate fires that have already passed are skipped, so a rule that
 * was missed while the app was closed produces exactly one catch-up notification
 * (ADR-0001). Returns null when the rule is exhausted: a one-shot rule, the
 * boundary passed, or an invalid configuration.
 */
export function computeNextReminderFire(task: TaskRow): string | null {
  if (task.reminder_recurrence === 'once' || !task.reminder_at) {
    return null
  }
  if (
    task.reminder_recurrence === 'everyN' &&
    (task.reminder_interval === null || task.reminder_interval < 1)
  ) {
    return null
  }
  if (task.reminder_follow_duration === 1 && !task.end_date) {
    return null
  }

  const endDay = boundaryEndDay(task)
  const time = task.reminder_time ?? '09:00'
  let base = task.reminder_at.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) {
    return null
  }
  const now = Date.now()

  for (let guard = 0; guard < 10_000; guard++) {
    base = advanceDate(base, task.reminder_recurrence, task.reminder_interval)
    if (endDay && base > endDay) {
      return null
    }
    const candidate = `${base}T${time}`
    if (Date.parse(candidate) > now) {
      return candidate
    }
  }
  return null
}
