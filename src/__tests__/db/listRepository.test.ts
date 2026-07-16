import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import {
  createList,
  deleteList,
  getAllLists,
  getListById,
  getListsWithTaskCount,
  updateList,
} from '../../main/db/repositories/listRepository.js'
import { createTask, getTasksByListId, updateTask } from '../../main/db/repositories/taskRepository.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-list-repo-test-'))
}

describe('list repository', () => {
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

  it('creates, gets, and lists all lists', () => {
    const inbox = createList('Inbox')
    const work = createList('Work')

    expect(getListById(inbox.id)).toEqual(inbox)
    expect(getAllLists().map((list) => list.name)).toEqual(['Inbox', 'Work'])
    expect(work.id).toBeGreaterThan(inbox.id)
  })

  it('rejects duplicate and empty names', () => {
    createList('Inbox')

    expect(() => createList('Inbox')).toThrow(/already exists/i)
    expect(() => createList('   ')).toThrow(/must not be empty/i)
  })

  it('updates a list and rejects duplicate update names', () => {
    const inbox = createList('Inbox')
    createList('Work')

    expect(updateList(inbox.id, 'Personal')).toMatchObject({ id: inbox.id, name: 'Personal' })
    expect(() => updateList(inbox.id, 'Work')).toThrow(/already exists/i)
  })

  it('deletes a list and cascades its tasks', () => {
    const inbox = createList('Inbox')
    createTask({ list_id: inbox.id, title: 'Buy milk' })

    deleteList(inbox.id)

    expect(getListById(inbox.id)).toBeUndefined()
    expect(getTasksByListId(inbox.id)).toEqual([])
  })

  it('returns total and completed task counts per list', () => {
    const inbox = createList('Inbox')
    const work = createList('Work')
    createTask({ list_id: inbox.id, title: 'Buy milk' })
    const taxes = createTask({ list_id: inbox.id, title: 'File taxes' })
    updateTask(taxes.id, { completed: true })
    createTask({ list_id: work.id, title: 'Review PR' })

    expect(getListsWithTaskCount()).toMatchObject([
      { id: inbox.id, name: 'Inbox', totalCount: 2, completedCount: 1 },
      { id: work.id, name: 'Work', totalCount: 1, completedCount: 0 },
    ])
  })
})
