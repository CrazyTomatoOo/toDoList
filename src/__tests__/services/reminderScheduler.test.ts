import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReminderScheduler } from '../../main/services/reminderScheduler.js'
import type { TaskRow } from '../../shared/ipc.js'

function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 1,
    list_id: 1,
    title: 'Task',
    description: null,
    priority: 'medium',
    due_date: null,
    reminder_at: null,
    completed: 0,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function createMockNotification() {
  const clickHandlers: Array<() => void> = []
  const show = vi.fn()
  const notification = {
    show,
    on: vi.fn((event: string, handler: () => void) => {
      if (event === 'click') clickHandlers.push(handler)
      return notification
    }),
    click: () => clickHandlers.forEach((handler) => handler()),
  }
  return notification
}

function createSchedulerDeps(tasks: TaskRow[] = []) {
  let pending = [...tasks]
  return {
    getPendingReminders: vi.fn(() => pending),
    clearReminder: vi.fn((id: number) => {
      pending = pending.filter((t) => t.id !== id)
    }),
    createNotification: vi.fn(() => createMockNotification() as unknown as Electron.Notification),
    onNotificationClick: vi.fn(),
  }
}


describe('ReminderScheduler', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('shows a notification when a task reminder is in the past', () => {
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    const task = makeTask({ id: 42, title: 'Past reminder', reminder_at: pastReminder })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Past reminder',
        body: 'Reminder',
      })
    )
    expect(deps.clearReminder).toHaveBeenCalledWith(42)
    expect(deps.onNotificationClick).not.toHaveBeenCalled()
  })

  it('does not notify a completed task', () => {
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    const task = makeTask({ reminder_at: pastReminder, completed: 1 })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).not.toHaveBeenCalled()
    expect(deps.clearReminder).not.toHaveBeenCalled()
  })

  it('does not notify a task with a future reminder', () => {
    const futureReminder = new Date(Date.now() + 60_000).toISOString()
    const task = makeTask({ reminder_at: futureReminder })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).not.toHaveBeenCalled()
    expect(deps.clearReminder).not.toHaveBeenCalled()
  })

  it('does not re-fire a reminder that was already fired', () => {
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    let tasks = [makeTask({ reminder_at: pastReminder })]
    const deps = {
      ...createSchedulerDeps(),
      getPendingReminders: vi.fn(() => tasks),
      clearReminder: vi.fn(() => {
        tasks = []
      }),
    }
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()
    expect(deps.createNotification).toHaveBeenCalledTimes(1)

    scheduler.check()
    expect(deps.createNotification).toHaveBeenCalledTimes(1)
    expect(deps.clearReminder).toHaveBeenCalledTimes(1)
  })


  it('handles multiple reminders in one check', () => {
    const now = Date.now()
    const tasks = [
      makeTask({ id: 1, title: 'First', reminder_at: new Date(now - 2000).toISOString() }),
      makeTask({ id: 2, title: 'Second', reminder_at: new Date(now - 1000).toISOString() }),
    ]
    const deps = createSchedulerDeps(tasks)
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).toHaveBeenCalledTimes(2)
    expect(deps.clearReminder).toHaveBeenCalledWith(1)
    expect(deps.clearReminder).toHaveBeenCalledWith(2)
  })

  it('invokes the click handler when a notification is clicked', () => {
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    const task = makeTask({ id: 7, list_id: 3, title: 'Click me', reminder_at: pastReminder })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    const notification = deps.createNotification.mock.results[0].value as ReturnType<typeof createMockNotification>
    notification.click()

    expect(deps.onNotificationClick).toHaveBeenCalledWith(task)
  })

  it('ignores tasks with unparsable reminder dates', () => {
    const task = makeTask({ reminder_at: 'not-a-date' })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).not.toHaveBeenCalled()
    expect(deps.clearReminder).not.toHaveBeenCalled()
  })

  it('starts polling on an interval and stops when told', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'Date'] })
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    const task = makeTask({ reminder_at: pastReminder })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler({ ...deps, pollIntervalMs: 5000 })

    scheduler.start()
    expect(deps.createNotification).toHaveBeenCalledTimes(1)

    deps.createNotification.mockClear()
    deps.clearReminder.mockClear()

    scheduler.stop()
    vi.advanceTimersByTime(15_000)
    expect(deps.createNotification).not.toHaveBeenCalled()
    expect(deps.clearReminder).not.toHaveBeenCalled()

    vi.useRealTimers()
  })
})
