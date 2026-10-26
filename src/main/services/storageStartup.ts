import { app } from 'electron'
import { getDb } from '../db/connection.js'
import { runMigrations } from '../db/migrations.js'
import {
  getTasksWithPendingReminders,
  updateReminderNextFire,
} from '../db/repositories/taskRepository.js'
import { computeNextReminderFire } from '../db/repositories/reminderSchedule.js'
import { ReminderScheduler } from './reminderScheduler.js'
import { initThemeSource } from './theme.js'
import { getMainWindow } from '../window.js'
import {
  REMINDER_FIRED_CHANNEL,
  type ReminderClickedPayload,
} from '../../shared/ipc.js'

/**
 * Open the database and start every storage-backed service (migrations,
 * reminder scheduler, native theme). Used by BOTH the normal boot path and the
 * safe-mode recovery path (issue #15), so the two can never drift apart.
 *
 * Synchronous and idempotent: every work item here is synchronous despite the
 * historical dynamic import in main.ts (connection.js is already statically
 * loaded via the repositories, so the lazy import provided no real isolation).
 * The `started` guard is set before any work so a partial failure never starts
 * the reminder scheduler a second time on a later re-entry.
 */
let started = false

export function startStorageServices(): void {
  if (started) {
    return
  }
  started = true

  getDb()
  runMigrations()

  const pollIntervalMs = process.env.REMINDER_POLL_INTERVAL_MS
    ? parseInt(process.env.REMINDER_POLL_INTERVAL_MS, 10)
    : 10_000
  const scheduler = new ReminderScheduler({
    getPendingReminders: getTasksWithPendingReminders,
    completeReminder: (task) => {
      const nextFire = computeNextReminderFire(task)
      updateReminderNextFire(task.id, nextFire)
    },
    pollIntervalMs,
    onReminderFired: (task) => {
      const win = getMainWindow()
      if (win) {
        win.webContents.send(REMINDER_FIRED_CHANNEL, {
          taskId: task.id,
          listId: task.list_id,
        } as ReminderClickedPayload)
      }
    },
  })
  scheduler.start()
  app.on('before-quit', () => scheduler.stop())

  // Native chrome (date picker, menus, dialogs) follows the saved mode,
  // not the OS — see initThemeSource().
  initThemeSource()
}