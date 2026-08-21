import { describe, it, expect, vi, afterEach } from 'vitest'
import type { TaskRow } from '../../shared/ipc.js'
import {
  computeNextReminderFire,
  shouldFireReminder,
} from '../../main/db/repositories/reminderSchedule.js'

function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 1,
    list_id: 1,
    title: 'Task',
    description: null,
    priority: 'medium',
    due_date: null,
    reminder_at: null,
    reminder_recurrence: 'once',
    reminder_interval: null,
    reminder_end_date: null,
    reminder_follow_duration: 0,
    reminder_time: null,
    completed: 0,
    sort_order: 0,
    recurrence: null,
    recurrence_end_date: null,
    start_date: null,
    end_date: null,
    is_urgent: 0,
    is_important: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('computeNextReminderFire', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for a one-shot rule', () => {
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'once',
          reminder_at: '2026-08-21T09:00',
        }),
      ),
    ).toBeNull()
  })

  it('returns null when there is no reminder_at', () => {
    expect(
      computeNextReminderFire(makeTask({ reminder_recurrence: 'daily' })),
    ).toBeNull()
  })

  it('returns null for an invalid everyN rule without interval', () => {
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'everyN',
          reminder_interval: null,
          reminder_at: '2026-08-21T09:00',
        }),
      ),
    ).toBeNull()
  })

  it('returns null for a follow-duration rule without an end date', () => {
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'daily',
          reminder_follow_duration: 1,
          end_date: null,
          reminder_at: '2026-08-21T09:00',
        }),
      ),
    ).toBeNull()
  })

  it('advances a daily rule to the next fire time', () => {
    vi.useFakeTimers({ now: new Date('2026-08-21T08:00') })
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'daily',
          reminder_time: '09:00',
          reminder_at: '2026-08-20T09:00',
        }),
      ),
    ).toBe('2026-08-21T09:00')
  })

  it('collapses missed fires: skips every intermediate fire already in the past', () => {
    vi.useFakeTimers({ now: new Date('2026-08-21T08:00') })
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'daily',
          reminder_time: '09:00',
          reminder_at: '2026-08-17T09:00',
        }),
      ),
    ).toBe('2026-08-21T09:00')
  })

  it('honors the rule time-of-day', () => {
    vi.useFakeTimers({ now: new Date('2026-08-21T08:00') })
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'daily',
          reminder_time: '14:30',
          reminder_at: '2026-08-17T14:30',
        }),
      ),
    ).toBe('2026-08-21T14:30')
  })

  it('advances everyN by the configured interval', () => {
    vi.useFakeTimers({ now: new Date('2026-08-21T08:00') })
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'everyN',
          reminder_interval: 3,
          reminder_time: '09:00',
          reminder_at: '2026-08-15T09:00',
        }),
      ),
    ).toBe('2026-08-21T09:00')
  })

  it('advances weekly by seven days, keeping the anchor weekday', () => {
    vi.useFakeTimers({ now: new Date('2026-08-21T08:00') })
    // 2026-08-01 is a Saturday.
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'weekly',
          reminder_time: '09:00',
          reminder_at: '2026-08-01T09:00',
        }),
      ),
    ).toBe('2026-08-22T09:00')
  })

  it('clamps monthly to the last day of the target month', () => {
    vi.useFakeTimers({ now: new Date('2026-02-01T08:00') })
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'monthly',
          reminder_time: '09:00',
          reminder_at: '2026-01-31T09:00',
        }),
      ),
    ).toBe('2026-02-28T09:00')
  })

  it('handles leap-year February in yearly cadence', () => {
    vi.useFakeTimers({ now: new Date('2024-03-01T08:00') })
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'yearly',
          reminder_time: '09:00',
          reminder_at: '2024-02-29T09:00',
        }),
      ),
    ).toBe('2025-02-28T09:00')
  })

  it('stops when the next fire passes a static end date (inclusive end-day)', () => {
    vi.useFakeTimers({ now: new Date('2026-08-21T08:00') })
    // A fire on the end day itself is still allowed...
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'daily',
          reminder_time: '09:00',
          reminder_end_date: '2026-08-21',
          reminder_at: '2026-08-20T09:00',
        }),
      ),
    ).toBe('2026-08-21T09:00')
    // ...but the step beyond it ends the rule.
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'daily',
          reminder_time: '09:00',
          reminder_end_date: '2026-08-20',
          reminder_at: '2026-08-19T09:00',
        }),
      ),
    ).toBeNull()
  })

  it('binds the end boundary to the task duration when following it', () => {
    vi.useFakeTimers({ now: new Date('2026-08-21T08:00') })
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'daily',
          reminder_time: '09:00',
          reminder_follow_duration: 1,
          start_date: '2026-08-01',
          end_date: '2026-08-21',
          reminder_at: '2026-08-20T09:00',
        }),
      ),
    ).toBe('2026-08-21T09:00')
  })

  it('falls back to 09:00 when the rule has no reminder_time', () => {
    vi.useFakeTimers({ now: new Date('2026-08-21T08:00') })
    expect(
      computeNextReminderFire(
        makeTask({
          reminder_recurrence: 'daily',
          reminder_time: null,
          reminder_at: '2026-08-20T08:00',
        }),
      ),
    ).toBe('2026-08-21T09:00')
  })
})

describe('shouldFireReminder', () => {
  it('fires unbounded rules regardless of the fire day', () => {
    expect(
      shouldFireReminder(
        makeTask({
          reminder_at: '2026-08-21T09:00',
          reminder_recurrence: 'daily',
        }),
      ),
    ).toBe(true)
  })

  it('fires on the static end date and stops after it', () => {
    const base = {
      reminder_recurrence: 'daily' as const,
      reminder_end_date: '2026-08-21',
    }
    expect(
      shouldFireReminder(
        makeTask({ ...base, reminder_at: '2026-08-21T09:00' }),
      ),
    ).toBe(true)
    expect(
      shouldFireReminder(
        makeTask({ ...base, reminder_at: '2026-08-22T09:00' }),
      ),
    ).toBe(false)
  })

  it('gates follow-duration rules on both duration ends', () => {
    const base = {
      reminder_recurrence: 'daily' as const,
      reminder_follow_duration: 1 as const,
      start_date: '2026-08-01',
      end_date: '2026-08-21',
    }
    expect(
      shouldFireReminder(
        makeTask({ ...base, reminder_at: '2026-08-01T09:00' }),
      ),
    ).toBe(true)
    expect(
      shouldFireReminder(
        makeTask({ ...base, reminder_at: '2026-07-31T09:00' }),
      ),
    ).toBe(false)
    expect(
      shouldFireReminder(
        makeTask({ ...base, reminder_at: '2026-08-22T09:00' }),
      ),
    ).toBe(false)
  })

  it('never fires a follow-duration rule without an end date', () => {
    expect(
      shouldFireReminder(
        makeTask({
          reminder_recurrence: 'daily',
          reminder_follow_duration: 1,
          start_date: '2026-08-01',
          end_date: null,
          reminder_at: '2026-08-01T09:00',
        }),
      ),
    ).toBe(false)
  })

  it('returns false when there is no reminder_at', () => {
    expect(shouldFireReminder(makeTask({ reminder_at: null }))).toBe(false)
  })
})
