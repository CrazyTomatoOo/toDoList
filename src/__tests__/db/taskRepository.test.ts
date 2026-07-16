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

    expect(task).toMatchObject({ list_id: list.id, title: 'Buy milk', priority: 'medium', completed: 0, sort_order: 0 })
    expect(getTaskById(task.id)).toEqual(task)
  })

  it('updates and deletes a task', () => {
    const list = createList('Inbox')
    const task = createTask({ list_id: list.id, title: 'Draft note' })

    const updated = updateTask(task.id, { title: 'Send note', completed: true, priority: 'high' })
    expect(updated).toMatchObject({ title: 'Send note', completed: 1, priority: 'high' })

    deleteTask(task.id)
    expect(getTaskById(task.id)).toBeUndefined()
  })

  it('filters list tasks by completed, priority, and search', () => {
    const list = createList('Inbox')
    createTask({ list_id: list.id, title: 'Buy milk', description: 'from corner shop', priority: 'high' })
    const done = createTask({ list_id: list.id, title: 'File taxes', description: 'annual forms', priority: 'low' })
    updateTask(done.id, { completed: true })

    expect(getTasksByListId(list.id, { completed: false })).toHaveLength(1)
    expect(getTasksByListId(list.id, { priority: 'low' })).toHaveLength(1)
    expect(getTasksByListId(list.id, { search: 'CORNER' }).map((task) => task.title)).toEqual(['Buy milk'])
  })

  it('searches title and description with optional filters', () => {
    const inbox = createList('Inbox')
    const work = createList('Work')
    createTask({ list_id: inbox.id, title: 'Buy milk', description: 'organic', priority: 'high' })
    createTask({ list_id: work.id, title: 'Review PR', description: 'milk wording', priority: 'medium' })

    expect(searchTasks('milk')).toHaveLength(2)
    expect(searchTasks('milk', { listId: inbox.id, priority: 'high' }).map((task) => task.title)).toEqual(['Buy milk'])
  })

  it('updates task sort order within a transaction', () => {
    const list = createList('Inbox')
    const first = createTask({ list_id: list.id, title: 'First' })
    const second = createTask({ list_id: list.id, title: 'Second' })
    const third = createTask({ list_id: list.id, title: 'Third' })

    updateTaskSortOrder(list.id, [third.id, first.id, second.id])

    expect(getTasksByListId(list.id).map((task) => task.title)).toEqual(['Third', 'First', 'Second'])
  })

  it('rejects empty titles and tasks for missing lists', () => {
    const list = createList('Inbox')
    expect(() => createTask({ list_id: list.id, title: '   ' })).toThrow(/title must not be empty/i)
    expect(() => createTask({ list_id: 999, title: 'Orphan' })).toThrow(/list does not exist/i)
  })

  it('rolls back sort updates when a task is from another list', () => {
    const inbox = createList('Inbox')
    const work = createList('Work')
    const first = createTask({ list_id: inbox.id, title: 'First' })
    const second = createTask({ list_id: inbox.id, title: 'Second' })
    const outsider = createTask({ list_id: work.id, title: 'Outsider' })

    expect(() => updateTaskSortOrder(inbox.id, [second.id, outsider.id, first.id])).toThrow(/belong to the requested list/i)
    expect(getTasksByListId(inbox.id).map((task) => task.title)).toEqual(['First', 'Second'])
  })

  it('returns only incomplete tasks that have a reminder', () => {
    const list = createList('Inbox')
    const past = new Date(Date.now() - 60_000).toISOString()
    const future = new Date(Date.now() + 60_000).toISOString()

    createTask({ list_id: list.id, title: 'No reminder' })
    const pastTask = createTask({ list_id: list.id, title: 'Past reminder', reminder_at: past })
    const futureTask = createTask({ list_id: list.id, title: 'Future reminder', reminder_at: future })
    const done = createTask({ list_id: list.id, title: 'Completed reminder', reminder_at: past })
    updateTask(done.id, { completed: true })

    const result = getTasksWithPendingReminders()
    expect(result.map((task) => task.id)).toEqual([pastTask.id, futureTask.id])
  })

})
