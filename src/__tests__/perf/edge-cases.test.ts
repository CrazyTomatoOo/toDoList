import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createList, getAllLists } from '../../main/db/repositories/listRepository.js'
import { createTask, getTasksByListId } from '../../main/db/repositories/taskRepository.js'
import { importFromCsv, importFromJson } from '../../main/services/importExport.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-edge-test-'))
}

describe('edge cases', () => {
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

  it('handles an empty database gracefully', () => {
    expect(getAllLists()).toEqual([])
    expect(getTasksByListId(12345)).toEqual([])
  })

  it('rejects task titles longer than 200 characters', () => {
    const list = createList('Inbox')
    const longTitle = 'x'.repeat(201)

    expect(() => createTask({ list_id: list.id, title: longTitle })).toThrow(/200 characters or fewer/i)
    expect(getTasksByListId(list.id)).toEqual([])
  })

  it('rejects invalid due dates', () => {
    const list = createList('Inbox')

    expect(() => createTask({ list_id: list.id, title: 'Bad date', due_date: 'not-a-date' })).toThrow(/valid ISO date/i)
    expect(getTasksByListId(list.id)).toEqual([])
  })

  it('roundtrips Unicode and special characters in task fields', () => {
    const list = createList('特殊清单 ✨')
    const task = createTask({
      list_id: list.id,
      title: '买牛奶 & bread <script> "quotes" 🚀',
      description: 'Line 1\nLine 2 with commas, quotes " and emoji ✅',
      priority: 'high',
    })

    const [stored] = getTasksByListId(list.id)
    expect(stored.title).toBe(task.title)
    expect(stored.description).toBe(task.description)
  })

  it('throws clear import errors without corrupting the database', () => {
    expect(() => importFromCsv('title,priority\nMissing list,medium')).toThrow(/Missing CSV columns: listName/i)
    expect(getAllLists()).toEqual([])

    const malformedJson = JSON.stringify({
      lists: [{ id: 1, name: 'Work' }],
      tasks: [
        { listName: 'Work', title: 'Valid', priority: 'medium', completed: false },
        { listName: 'Work', title: '', priority: 'medium', completed: false },
      ],
    })

    expect(() => importFromJson(malformedJson)).toThrow(/Task title must be a non-empty string/i)
    expect(getAllLists()).toEqual([])
  })

  it('rejects imported invalid dates before writing partial data', () => {
    const payload = JSON.stringify({
      lists: [{ id: 1, name: 'Work' }],
      tasks: [{ listName: 'Work', title: 'Bad date', priority: 'medium', dueDate: 'tomorrow-ish' }],
    })

    expect(() => importFromJson(payload)).toThrow(/valid ISO date/i)
    expect(getAllLists()).toEqual([])
  })
})
