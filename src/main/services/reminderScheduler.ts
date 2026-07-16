import { Notification } from 'electron'
import type { TaskRow } from '../../shared/ipc.js'
import { focusMainWindow, getMainWindow } from '../window.js'

export interface ReminderSchedulerDependencies {
  /** Return all tasks that still have an active reminder. */
  getPendingReminders: () => TaskRow[]
  /** Called after a reminder is fired so the reminder can be cleared from storage. */
  clearReminder: (id: number) => void
  /** Create and return a notification instance. Overridable for tests. */
  createNotification?: (options: Electron.NotificationConstructorOptions) => Electron.Notification
  /** Called when the user clicks a reminder notification. */
  onNotificationClick?: (task: TaskRow) => void
  /** Called when a reminder is fired (after the notification is shown). */
  onReminderFired?: (task: TaskRow) => void
  /** Polling interval in milliseconds. Defaults to 10 seconds. */
  pollIntervalMs?: number
}

export class ReminderScheduler {
  private deps: Required<ReminderSchedulerDependencies>
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false

  constructor(deps: ReminderSchedulerDependencies) {
    this.deps = {
      createNotification: (options) => new Notification(options),
      onNotificationClick: defaultOnNotificationClick,
      onReminderFired: () => {},
      pollIntervalMs: 10_000,
      ...deps,
    }
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.check()
    this.timer = setInterval(() => this.check(), this.deps.pollIntervalMs)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.running = false
  }

  /** Perform a single poll. Public so tests can drive it directly. */
  check(): void {
    const now = Date.now()
    const tasks = this.deps.getPendingReminders()

    for (const task of tasks) {
      if (task.completed !== 0 || !task.reminder_at) continue
      const reminderTime = new Date(task.reminder_at).getTime()
      if (Number.isNaN(reminderTime)) continue
      if (reminderTime <= now) {
        this.fireReminder(task)
      }
    }

  }

  private fireReminder(task: TaskRow): void {
    const notification = this.deps.createNotification({
      title: task.title,
      body: task.description || 'Reminder',
    })
    notification.on('click', () => {
      this.deps.onNotificationClick(task)
    })
    notification.show()
    this.deps.clearReminder(task.id)
    this.deps.onReminderFired(task)
  }
}

function defaultOnNotificationClick(task: TaskRow): void {
  focusMainWindow()
  const win = getMainWindow()
  if (win) {
    win.webContents.send('reminder:clicked', { taskId: task.id, listId: task.list_id })
  }
}
