import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createList } from '../../main/db/repositories/listRepository.js'
import {
  createTask,
  getTasksByListId,
  searchTasks,
  updateTask,
} from '../../main/db/repositories/taskRepository.js'
import type { DurationFilter, Quadrant, Recurrence } from '../../shared/ipc.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-task-repo-new-fields-test-'))
}

describe('task repository new fields', () => {
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

  it('creates a task with recurrence and dates', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Recurring task',
      recurrence: 'daily',
      recurrence_end_date: '2024-12-31',
      due_date: '2024-01-01',
      start_date: '2024-01-01',
      end_date: '2024-01-07',
      is_urgent: true,
      is_important: true,
    })

    expect(task).toMatchObject({
      recurrence: 'daily',
      recurrence_end_date: '2024-12-31',
      due_date: '2024-01-01',
      start_date: '2024-01-01',
      end_date: '2024-01-07',
      is_urgent: 1,
      is_important: 1,
    })
  })

  it('creates a task with quadrant flags', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Quadrant task',
      is_urgent: true,
      is_important: false,
    })

    expect(task).toMatchObject({
      is_urgent: 1,
      is_important: 0,
    })
  })

  it('rejects invalid recurrence values', () => {
    const list = createList('Inbox')
    expect(() =>
      createTask({
        list_id: list.id,
        title: 'Bad recurrence',
        recurrence: 'hourly' as unknown as Recurrence,
      }),
    ).toThrow(/invalid recurrence/i)
  })

  it('rejects invalid date format', () => {
    const list = createList('Inbox')
    expect(() =>
      createTask({
        list_id: list.id,
        title: 'Bad start date',
        start_date: '2024-13-01',
      }),
    ).toThrow(/valid YYYY-MM-DD/i)

    expect(() =>
      createTask({
        list_id: list.id,
        title: 'Bad end date',
        end_date: '2024-01-32',
      }),
    ).toThrow(/valid YYYY-MM-DD/i)

    expect(() =>
      createTask({
        list_id: list.id,
        title: 'Bad due date with recurrence',
        recurrence: 'daily',
        due_date: '2024-01-01T00:00:00.000Z',
      }),
    ).toThrow(/valid YYYY-MM-DD/i)
  })

  it('rejects start_date greater than end_date', () => {
    const list = createList('Inbox')
    expect(() =>
      createTask({
        list_id: list.id,
        title: 'Bad range',
        start_date: '2024-02-01',
        end_date: '2024-01-01',
      }),
    ).toThrow(/start date must be before or equal to end date/i)
  })

  it('searches by recurrence', () => {
    const list = createList('Inbox')
    createTask({ list_id: list.id, title: 'Daily', recurrence: 'daily' })
    createTask({ list_id: list.id, title: 'Weekly', recurrence: 'weekly' })
    createTask({ list_id: list.id, title: 'None' })

    const daily = searchTasks('', { recurrence: 'daily' })
    expect(daily).toHaveLength(1)
    expect(daily[0].title).toBe('Daily')

    const weekly = searchTasks('', { recurrence: 'weekly' })
    expect(weekly).toHaveLength(1)
    expect(weekly[0].title).toBe('Weekly')
  })

  it('filters by durationFilter', () => {
    const list = createList('Inbox')
    createTask({
      list_id: list.id,
      title: 'Has range',
      start_date: '2024-01-01',
      end_date: '2024-01-07',
    })
    createTask({ list_id: list.id, title: 'Only start', start_date: '2024-01-01' })
    createTask({ list_id: list.id, title: 'No range' })

    expect(searchTasks('', { durationFilter: 'hasDateRange' as DurationFilter })).toHaveLength(2)
    expect(searchTasks('', { durationFilter: 'noDateRange' as DurationFilter })).toHaveLength(1)
    expect(searchTasks('', { durationFilter: 'all' as DurationFilter })).toHaveLength(3)
  })

  it('filters by quadrant', () => {
    const list = createList('Inbox')
    createTask({ list_id: list.id, title: 'Q1', is_urgent: true, is_important: true })
    createTask({ list_id: list.id, title: 'Q2', is_urgent: false, is_important: true })
    createTask({ list_id: list.id, title: 'Q3', is_urgent: true, is_important: false })

    const q1 = searchTasks('', { quadrant: 'q1-urgent-important' as Quadrant })
    expect(q1).toHaveLength(1)
    expect(q1[0].title).toBe('Q1')

    const q2 = searchTasks('', { quadrant: 'q2-not-urgent-important' as Quadrant })
    expect(q2).toHaveLength(1)
    expect(q2[0].title).toBe('Q2')

    expect(searchTasks('', { quadrant: 'q4-not-urgent-not-important' as Quadrant })).toHaveLength(0)
  })

  it('filters list tasks by quadrant', () => {
    const list = createList('Inbox')
    createTask({ list_id: list.id, title: 'Q1', is_urgent: true, is_important: true })
    createTask({ list_id: list.id, title: 'Q2', is_urgent: false, is_important: true })

    const q1 = getTasksByListId(list.id, { quadrant: 'q1-urgent-important' as Quadrant })
    expect(q1).toHaveLength(1)
    expect(q1[0].title).toBe('Q1')
  })

  it('updates new fields', () => {
    const list = createList('Inbox')
    const task = createTask({ list_id: list.id, title: 'Original' })
    const updated = updateTask(task.id, {
      recurrence: 'weekly',
      recurrence_end_date: '2024-12-31',
      start_date: '2024-01-01',
      end_date: '2024-01-07',
      is_urgent: true,
      is_important: true,
    })

    expect(updated).toMatchObject({
      recurrence: 'weekly',
      recurrence_end_date: '2024-12-31',
      start_date: '2024-01-01',
      end_date: '2024-01-07',
      is_urgent: 1,
      is_important: 1,
    })
  })
})
