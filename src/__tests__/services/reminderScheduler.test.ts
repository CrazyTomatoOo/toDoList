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
    reminder_recurrence: 'once',
    reminder_interval: null,
    reminder_end_date: null,
    reminder_follow_duration: 0,
    reminder_time: null,
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
    completeReminder: vi.fn((task: TaskRow) => {
      pending = pending.filter((t) => t.id !== task.id)
    }),
    createNotification: vi.fn(
      () => createMockNotification() as unknown as Electron.Notification,
    ),
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
    const task = makeTask({
      id: 42,
      title: 'Past reminder',
      reminder_at: pastReminder,
    })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Past reminder',
        body: '提醒',
      }),
    )
    expect(deps.completeReminder).toHaveBeenCalledWith(task)
    expect(deps.onNotificationClick).not.toHaveBeenCalled()
  })

  it('does not notify a completed task', () => {
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    const task = makeTask({ reminder_at: pastReminder, completed: 1 })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).not.toHaveBeenCalled()
    expect(deps.completeReminder).not.toHaveBeenCalled()
  })

  it('does not notify a task with a future reminder', () => {
    const futureReminder = new Date(Date.now() + 60_000).toISOString()
    const task = makeTask({ reminder_at: futureReminder })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).not.toHaveBeenCalled()
    expect(deps.completeReminder).not.toHaveBeenCalled()
  })

  it('does not re-fire a reminder that was already fired', () => {
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    let tasks = [makeTask({ reminder_at: pastReminder })]
    const deps = {
      ...createSchedulerDeps(),
      getPendingReminders: vi.fn(() => tasks),
      completeReminder: vi.fn(() => {
        tasks = []
      }),
    }
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()
    expect(deps.createNotification).toHaveBeenCalledTimes(1)

    scheduler.check()
    expect(deps.createNotification).toHaveBeenCalledTimes(1)
    expect(deps.completeReminder).toHaveBeenCalledTimes(1)
  })

  it('handles multiple reminders in one check', () => {
    const now = Date.now()
    const tasks = [
      makeTask({
        id: 1,
        title: 'First',
        reminder_at: new Date(now - 2000).toISOString(),
      }),
      makeTask({
        id: 2,
        title: 'Second',
        reminder_at: new Date(now - 1000).toISOString(),
      }),
    ]
    const deps = createSchedulerDeps(tasks)
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).toHaveBeenCalledTimes(2)
    expect(deps.completeReminder).toHaveBeenCalledWith(tasks[0])
    expect(deps.completeReminder).toHaveBeenCalledWith(tasks[1])
  })

  it('invokes the click handler when a notification is clicked', () => {
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    const task = makeTask({
      id: 7,
      list_id: 3,
      title: 'Click me',
      reminder_at: pastReminder,
    })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    const notification = deps.createNotification.mock.results[0]
      .value as ReturnType<typeof createMockNotification>
    notification.click()

    expect(deps.onNotificationClick).toHaveBeenCalledWith(task)
  })

  it('ignores tasks with unparsable reminder dates', () => {
    const task = makeTask({ reminder_at: 'not-a-date' })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).not.toHaveBeenCalled()
    expect(deps.completeReminder).not.toHaveBeenCalled()
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
    deps.completeReminder.mockClear()

    scheduler.stop()
    vi.advanceTimersByTime(15_000)
    expect(deps.createNotification).not.toHaveBeenCalled()
    expect(deps.completeReminder).not.toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('advances a repeating rule instead of clearing it', () => {
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    const task = makeTask({
      reminder_at: pastReminder,
      reminder_recurrence: 'daily',
      reminder_time: '09:00',
    })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).toHaveBeenCalledTimes(1)
    expect(deps.completeReminder).toHaveBeenCalledWith(task)
  })

  it('silently advances a due reminder whose fire day is outside the boundary', () => {
    const pastReminder = new Date(Date.now() - 1000).toISOString()
    const task = makeTask({
      reminder_at: pastReminder,
      reminder_recurrence: 'daily',
      reminder_time: '09:00',
      reminder_end_date: '2020-01-01',
    })
    const deps = createSchedulerDeps([task])
    const scheduler = new ReminderScheduler(deps)

    scheduler.check()

    expect(deps.createNotification).not.toHaveBeenCalled()
    expect(deps.completeReminder).toHaveBeenCalledWith(task)
  })
})
