import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createList } from '../../main/db/repositories/listRepository.js'
import { getAllLists } from '../../main/db/repositories/listRepository.js'
import { createTask, getTasksByListId } from '../../main/db/repositories/taskRepository.js'
import { exportToCsv, exportToJson, importFromCsv, importFromJson } from '../../main/services/importExport.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-import-export-test-'))
}

describe('importExport service', () => {
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

  it('exports JSON with nested lists and tasks', () => {
    const work = createList('Work')
    createTask({ list_id: work.id, title: 'Task 1', description: 'A description', priority: 'high' })

    const json = exportToJson()
    const data = JSON.parse(json) as { lists: unknown[]; tasks: unknown[] }

    expect(data.lists).toHaveLength(1)
    expect(data.tasks).toHaveLength(1)
    expect((data.lists[0] as { name: string }).name).toBe('Work')
    expect(data.tasks[0]).toMatchObject({
      listName: 'Work',
      title: 'Task 1',
      description: 'A description',
      priority: 'high',
      completed: false,
    })
  })

  it('exports CSV with header and task rows', () => {
    const work = createList('Work')
    createTask({ list_id: work.id, title: 'Task 1', priority: 'medium' })

    const csv = exportToCsv()
    const lines = csv.split('\n')

    expect(lines[0]).toBe('listName,title,description,priority,dueDate,reminderAt,completed,sortOrder')
    expect(lines[1]).toContain('Task 1')
    expect(lines[1]).toContain('Work')
  })

  it('imports JSON and merges lists by name', () => {
    const existing = createList('Work')
    createTask({ list_id: existing.id, title: 'Existing' })

    const json = JSON.stringify({
      lists: [
        { id: 999, name: 'Work', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' },
      ],
      tasks: [
        {
          listName: 'Work',
          title: 'Imported',
          description: null,
          priority: 'high',
          dueDate: null,
          reminderAt: null,
          completed: false,
          sortOrder: 0,
        },
      ],
    })

    const result = importFromJson(json)
    expect(result.importedLists).toBe(0)
    expect(result.importedTasks).toBe(1)

    const lists = getAllLists()
    expect(lists).toHaveLength(1)
    expect(lists[0].name).toBe('Work')

    const tasks = getTasksByListId(existing.id)
    expect(tasks).toHaveLength(2)
    expect(tasks.map((t) => t.title)).toContain('Imported')
  })

  it('imports CSV and creates missing lists', () => {
    const csv = 'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder\nPersonal,Buy milk,,medium,,,false,0'

    const result = importFromCsv(csv)
    expect(result.importedLists).toBe(1)
    expect(result.importedTasks).toBe(1)

    const lists = getAllLists()
    expect(lists).toHaveLength(1)
    expect(lists[0].name).toBe('Personal')

    const tasks = getTasksByListId(lists[0].id)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Buy milk')
  })

  it('does not duplicate lists with the same name', () => {
    createList('Work')

    const json = JSON.stringify({
      lists: [
        { id: 1, name: 'Work', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' },
        { id: 2, name: 'Work', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' },
      ],
      tasks: [],
    })

    const result = importFromJson(json)
    expect(result.importedLists).toBe(0)
    expect(result.importedTasks).toBe(0)
    expect(getAllLists()).toHaveLength(1)
  })

  it('appends imported tasks to the end of existing lists', () => {
    const work = createList('Work')
    createTask({ list_id: work.id, title: 'First' })
    createTask({ list_id: work.id, title: 'Second' })

    const json = JSON.stringify({
      lists: [],
      tasks: [
        { listName: 'Work', title: 'Imported', priority: 'low', completed: false },
      ],
    })

    importFromJson(json)

    const tasks = getTasksByListId(work.id)
    expect(tasks).toHaveLength(3)
    expect(tasks[2].title).toBe('Imported')
  })

  it('rejects tasks with empty titles', () => {
    const json = JSON.stringify({
      lists: [],
      tasks: [{ listName: 'Work', title: '', priority: 'medium', completed: false }],
    })

    expect(() => importFromJson(json)).toThrow(/title must be a non-empty string/i)
  })

  it('rejects invalid priority values', () => {
    const json = JSON.stringify({
      lists: [],
      tasks: [{ listName: 'Work', title: 'Bad priority', priority: 'urgent', completed: false }],
    })

    expect(() => importFromJson(json)).toThrow(/invalid priority/i)
  })

  it('rolls back the entire import when a task is invalid', () => {
    const json = JSON.stringify({
      lists: [{ id: 1, name: 'Work', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z' }],
      tasks: [
        { listName: 'Work', title: 'Valid', priority: 'medium', completed: false },
        { listName: 'Work', title: '', priority: 'medium', completed: false },
      ],
    })

    expect(() => importFromJson(json)).toThrow(/title must be a non-empty string/i)
    expect(getAllLists()).toHaveLength(0)
  })

  it('handles CSV fields with commas and quotes', () => {
    const csv = 'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder\n"Work,Personal","Note, with comma","Has ""quotes"" inside",high,,,false,0'

    importFromCsv(csv)

    const lists = getAllLists()
    expect(lists).toHaveLength(1)
    expect(lists[0].name).toBe('Work,Personal')

    const tasks = getTasksByListId(lists[0].id)
    expect(tasks[0].title).toBe('Note, with comma')
    expect(tasks[0].description).toBe('Has "quotes" inside')
  })
})
