import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createList } from '../../main/db/repositories/listRepository.js'
import {
  createTask,
  deleteTask,
  getTaskById,
  getTasksByListId,
  getTasksWithPendingReminders,
  searchTasks,
  updateTask,
  updateReminderNextFire,
  updateTaskSortOrder,
} from '../../main/db/repositories/taskRepository.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-task-repo-test-'))
}

describe('task repository', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempUserDataDir()
    process.env.TODO_USER_DATA_DIR = tempDir
    runMigrations()
  })

  afterEach(() => {
    closeDb()
    fs.rmSync(tempDir, { recursive: true, force: true })
    delete process.env.TODO_USER_DATA_DIR
  })

  it('creates and gets a task with defaults', () => {
    const list = createList('Inbox')
    const task = createTask({ list_id: list.id, title: 'Buy milk' })

    expect(task).toMatchObject({
      list_id: list.id,
      title: 'Buy milk',
      priority: 'medium',
      completed: 0,
      sort_order: 0,
    })
    expect(getTaskById(task.id)).toEqual(task)
  })

  it('updates and deletes a task', () => {
    const list = createList('Inbox')
    const task = createTask({ list_id: list.id, title: 'Draft note' })

    const updated = updateTask(task.id, {
      title: 'Send note',
      completed: true,
      priority: 'high',
    })
    expect(updated).toMatchObject({
      title: 'Send note',
      completed: 1,
      priority: 'high',
    })

    deleteTask(task.id)
    expect(getTaskById(task.id)).toBeUndefined()
  })

  it('filters list tasks by completed, priority, and search', () => {
    const list = createList('Inbox')
    createTask({
      list_id: list.id,
      title: 'Buy milk',
      description: 'from corner shop',
      priority: 'high',
    })
    const done = createTask({
      list_id: list.id,
      title: 'File taxes',
      description: 'annual forms',
      priority: 'low',
    })
    updateTask(done.id, { completed: true })

    expect(getTasksByListId(list.id, { completed: false })).toHaveLength(1)
    expect(getTasksByListId(list.id, { priority: 'low' })).toHaveLength(1)
    expect(
      getTasksByListId(list.id, { search: 'CORNER' }).map((task) => task.title),
    ).toEqual(['Buy milk'])
  })

  it('searches title and description with optional filters', () => {
    const inbox = createList('Inbox')
    const work = createList('Work')
    createTask({
      list_id: inbox.id,
      title: 'Buy milk',
      description: 'organic',
      priority: 'high',
    })
    createTask({
      list_id: work.id,
      title: 'Review PR',
      description: 'milk wording',
      priority: 'medium',
    })

    expect(searchTasks('milk')).toHaveLength(2)
    expect(
      searchTasks('milk', { listId: inbox.id, priority: 'high' }).map(
        (task) => task.title,
      ),
    ).toEqual(['Buy milk'])
  })

  it('updates task sort order within a transaction', () => {
    const list = createList('Inbox')
    const first = createTask({ list_id: list.id, title: 'First' })
    const second = createTask({ list_id: list.id, title: 'Second' })
    const third = createTask({ list_id: list.id, title: 'Third' })

    updateTaskSortOrder(list.id, [third.id, first.id, second.id])

    expect(getTasksByListId(list.id).map((task) => task.title)).toEqual([
      'Third',
      'First',
      'Second',
    ])
  })

  it('rejects empty titles and tasks for missing lists', () => {
    const list = createList('Inbox')
    expect(() => createTask({ list_id: list.id, title: '   ' })).toThrow(
      /不能为空/,
    )
    expect(() => createTask({ list_id: 999, title: 'Orphan' })).toThrow(
      /列表不存在/,
    )
  })

  it('rolls back sort updates when a task is from another list', () => {
    const inbox = createList('Inbox')
    const work = createList('Work')
    const first = createTask({ list_id: inbox.id, title: 'First' })
    const second = createTask({ list_id: inbox.id, title: 'Second' })
    const outsider = createTask({ list_id: work.id, title: 'Outsider' })

    expect(() =>
      updateTaskSortOrder(inbox.id, [second.id, outsider.id, first.id]),
    ).toThrow(/belong to the requested list/i)
    expect(getTasksByListId(inbox.id).map((task) => task.title)).toEqual([
      'First',
      'Second',
    ])
  })

  it('returns only incomplete tasks that have a reminder', () => {
    const list = createList('Inbox')
    const past = new Date(Date.now() - 60_000).toISOString()
    const future = new Date(Date.now() + 60_000).toISOString()

    createTask({ list_id: list.id, title: 'No reminder' })
    const pastTask = createTask({
      list_id: list.id,
      title: 'Past reminder',
      reminder_at: past,
    })
    const futureTask = createTask({
      list_id: list.id,
      title: 'Future reminder',
      reminder_at: future,
    })
    const done = createTask({
      list_id: list.id,
      title: 'Completed reminder',
      reminder_at: past,
    })
    updateTask(done.id, { completed: true })

    const result = getTasksWithPendingReminders()
    expect(result.map((task) => task.id)).toEqual([pastTask.id, futureTask.id])
  })

  it('defaults new tasks to a once reminder rule', () => {
    const list = createList('Inbox')
    const task = createTask({ list_id: list.id, title: 'Plain' })

    expect(task).toMatchObject({
      reminder_recurrence: 'once',
      reminder_interval: null,
      reminder_end_date: null,
      reminder_follow_duration: 0,
      reminder_time: null,
    })
  })

  it('persists a repeating reminder rule and derives the trigger time', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Take meds',
      reminder_at: '2026-08-21T09:00',
      reminder_recurrence: 'everyN',
      reminder_interval: 3,
      reminder_end_date: '2026-12-31',
    })

    expect(task).toMatchObject({
      reminder_recurrence: 'everyN',
      reminder_interval: 3,
      reminder_end_date: '2026-12-31',
      reminder_follow_duration: 0,
      reminder_time: '09:00',
    })
  })

  it('persists a follow-duration rule', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Daily during task',
      reminder_at: '2026-08-21T09:00',
      reminder_recurrence: 'daily',
      reminder_follow_duration: true,
      start_date: '2026-08-01',
      end_date: '2026-08-31',
    })

    expect(task).toMatchObject({
      reminder_recurrence: 'daily',
      reminder_follow_duration: 1,
      start_date: '2026-08-01',
      end_date: '2026-08-31',
    })
  })

  it('drops the interval when the cadence is not everyN', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Normalized rule',
      reminder_at: '2026-08-21T09:00',
      reminder_recurrence: 'weekly',
      reminder_interval: 5,
    })

    expect(task.reminder_interval).toBeNull()
  })

  it('clears the derived time when switching back to once', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Convert to once',
      reminder_at: '2026-08-21T09:00',
      reminder_recurrence: 'daily',
    })
    expect(task.reminder_time).toBe('09:00')

    const once = updateTask(task.id, { reminder_recurrence: 'once' })
    expect(once).toMatchObject({
      reminder_recurrence: 'once',
      reminder_interval: null,
      reminder_time: null,
    })
  })

  it('rejects everyN rules without an interval', () => {
    const list = createList('Inbox')
    expect(() =>
      createTask({
        list_id: list.id,
        title: 'Bad',
        reminder_recurrence: 'everyN',
      }),
    ).toThrow(/每 N 天提醒需要设置有效的间隔天数/)
  })

  it('rejects follow-duration rules without a task end date', () => {
    const list = createList('Inbox')
    expect(() =>
      createTask({
        list_id: list.id,
        title: 'Bad',
        reminder_recurrence: 'daily',
        reminder_follow_duration: true,
      }),
    ).toThrow(/跟随持续期的提醒需要任务设置结束日期/)
  })

  it('rejects an invalid reminder recurrence', () => {
    const list = createList('Inbox')
    expect(() =>
      createTask({
        list_id: list.id,
        title: 'Bad',
        reminder_recurrence: 'hourly' as never,
      }),
    ).toThrow(/无效的提醒重复类型/)
  })

  it('advances the next fire without touching the rule', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Advancing',
      reminder_at: '2026-08-21T09:00',
      reminder_recurrence: 'daily',
      reminder_time: '09:00',
    })

    updateReminderNextFire(task.id, '2026-08-22T09:00')
    const advanced = getTaskById(task.id)!
    expect(advanced.reminder_at).toBe('2026-08-22T09:00')
    expect(advanced.reminder_recurrence).toBe('daily')

    updateReminderNextFire(task.id, null)
    expect(getTaskById(task.id)!.reminder_at).toBeNull()
    expect(getTaskById(task.id)!.reminder_recurrence).toBe('daily')
  })
})
