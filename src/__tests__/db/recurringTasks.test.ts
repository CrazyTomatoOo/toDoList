import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createList } from '../../main/db/repositories/listRepository.js'
import {
  createTask,
  getTaskById,
  getTasksByListId,
  updateTask,
} from '../../main/db/repositories/taskRepository.js'
import { generateNextRecurringInstance } from '../../main/db/repositories/taskRecurrence.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-recurring-test-'))
}

describe('recurring task next-instance generation', () => {
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

  it('creates a daily recurring task with due date one day ahead', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Daily recurring',
      due_date: '2024-01-15',
      recurrence: 'daily',
    })

    const updated = updateTask(task.id, { completed: true })

    expect(updated.completed).toBe(1)
    const tasks = getTasksByListId(list.id)
    expect(tasks).toHaveLength(2)
    const nextInstance = tasks.find((t) => t.id !== task.id)
    expect(nextInstance).toBeDefined()
    expect(nextInstance?.due_date).toBe('2024-01-16')
    expect(nextInstance?.completed).toBe(0)
    expect(nextInstance?.recurrence).toBe('daily')
  })

  it('clamps monthly recurrence from Jan 31 to Feb 29 in leap year', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Monthly recurring',
      due_date: '2024-01-31',
      recurrence: 'monthly',
    })

    updateTask(task.id, { completed: true })

    const nextInstance = getTasksByListId(list.id).find((t) => t.id !== task.id)
    expect(nextInstance?.due_date).toBe('2024-02-29')
  })

  it('clamps yearly recurrence from Feb 29 to Feb 28 on non-leap year', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Yearly recurring',
      due_date: '2024-02-29',
      recurrence: 'yearly',
    })

    updateTask(task.id, { completed: true })

    const nextInstance = getTasksByListId(list.id).find((t) => t.id !== task.id)
    expect(nextInstance?.due_date).toBe('2025-02-28')
  })

  it('creates next instance when next due date equals recurrence end date', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Daily with end',
      due_date: '2024-01-15',
      recurrence: 'daily',
      recurrence_end_date: '2024-01-16',
    })

    updateTask(task.id, { completed: true })

    const nextInstance = getTasksByListId(list.id).find((t) => t.id !== task.id)
    expect(nextInstance).toBeDefined()
    expect(nextInstance?.due_date).toBe('2024-01-16')
  })

  it('does not create next instance when next due date is past recurrence end date', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Daily with end',
      due_date: '2024-01-15',
      recurrence: 'daily',
      recurrence_end_date: '2024-01-15',
    })

    updateTask(task.id, { completed: true })

    expect(getTasksByListId(list.id)).toHaveLength(1)
  })

  it('does not create a duplicate instance when toggling completed task back to incomplete', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Daily recurring',
      due_date: '2024-01-15',
      recurrence: 'daily',
    })

    updateTask(task.id, { completed: true })
    expect(getTasksByListId(list.id)).toHaveLength(2)

    updateTask(task.id, { completed: false })
    expect(getTasksByListId(list.id)).toHaveLength(2)
  })

  it('does not generate next instance when neither due_date nor start_date is set', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'No base date',
      recurrence: 'daily',
    })

    updateTask(task.id, { completed: true })

    expect(getTasksByListId(list.id)).toHaveLength(1)
  })

  it('does not generate next instance when editing an already completed recurring task', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Already done',
      due_date: '2024-01-15',
      recurrence: 'daily',
    })

    updateTask(task.id, { completed: true })
    expect(getTasksByListId(list.id)).toHaveLength(2)

    updateTask(task.id, { description: 'updated' })
    expect(getTasksByListId(list.id)).toHaveLength(2)
  })

  it('shifts start_date and end_date by the same recurrence interval', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Weekly range',
      due_date: '2024-01-15',
      start_date: '2024-01-10',
      end_date: '2024-01-20',
      recurrence: 'weekly',
    })

    updateTask(task.id, { completed: true })

    const nextInstance = getTasksByListId(list.id).find((t) => t.id !== task.id)
    expect(nextInstance?.start_date).toBe('2024-01-17')
    expect(nextInstance?.due_date).toBe('2024-01-22')
    expect(nextInstance?.end_date).toBe('2024-01-27')
  })

  it('uses start_date as base when due_date is missing', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Start only',
      start_date: '2024-01-15',
      recurrence: 'daily',
    })

    updateTask(task.id, { completed: true })

    const nextInstance = getTasksByListId(list.id).find((t) => t.id !== task.id)
    expect(nextInstance?.due_date).toBe('2024-01-16')
    expect(nextInstance?.start_date).toBe('2024-01-16')
  })

  it('inherited fields match the original task', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'Inherited',
      description: 'desc',
      priority: 'high',
      due_date: '2024-01-15',
      recurrence: 'daily',
      recurrence_end_date: '2024-01-20',
      is_urgent: true,
      is_important: true,
    })

    updateTask(task.id, { completed: true })

    const nextInstance = getTasksByListId(list.id).find((t) => t.id !== task.id)
    expect(nextInstance).toMatchObject({
      title: 'Inherited',
      description: 'desc',
      priority: 'high',
      recurrence: 'daily',
      recurrence_end_date: '2024-01-20',
      is_urgent: 1,
      is_important: 1,
      completed: 0,
    })
    expect(nextInstance?.reminder_at).toBeNull()
  })

  it('sets sort_order to max+1 in the list', () => {
    const list = createList('Inbox')
    createTask({ list_id: list.id, title: 'Existing' })
    const task = createTask({
      list_id: list.id,
      title: 'Recurring',
      due_date: '2024-01-15',
      recurrence: 'daily',
    })

    updateTask(task.id, { completed: true })

    const nextInstance = getTasksByListId(list.id).find((t) => t.id !== task.id && t.due_date === '2024-01-16')
    expect(nextInstance?.sort_order).toBe(2)
  })

  it('generateNextRecurringInstance returns undefined when base date is missing', () => {
    const list = createList('Inbox')
    const task = createTask({
      list_id: list.id,
      title: 'No base',
      recurrence: 'daily',
    })

    const result = generateNextRecurringInstance(getTaskById(task.id)!)

    expect(result).toBeUndefined()
  })
})
