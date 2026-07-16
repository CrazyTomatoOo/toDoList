import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createList } from '../../main/db/repositories/listRepository.js'
import { createTask, getTasksByQuadrant } from '../../main/db/repositories/taskRepository.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-quadrant-task-test-'))
}

describe('getTasksByQuadrant', () => {
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

  it('returns only tasks matching the requested quadrant', () => {
    const list = createList('Inbox')
    const q1 = createTask({ list_id: list.id, title: 'Q1 task', is_urgent: true, is_important: true })
    const q2 = createTask({ list_id: list.id, title: 'Q2 task', is_urgent: false, is_important: true })
    const q3 = createTask({ list_id: list.id, title: 'Q3 task', is_urgent: true, is_important: false })
    const q4 = createTask({ list_id: list.id, title: 'Q4 task', is_urgent: false, is_important: false })

    expect(getTasksByQuadrant(list.id, 'q1-urgent-important').map((task) => task.id)).toEqual([q1.id])
    expect(getTasksByQuadrant(list.id, 'q2-not-urgent-important').map((task) => task.id)).toEqual([q2.id])
    expect(getTasksByQuadrant(list.id, 'q3-urgent-not-important').map((task) => task.id)).toEqual([q3.id])
    expect(getTasksByQuadrant(list.id, 'q4-not-urgent-not-important').map((task) => task.id)).toEqual([q4.id])
  })

  it('respects list boundaries', () => {
    const inbox = createList('Inbox')
    const work = createList('Work')
    const inboxQ1 = createTask({ list_id: inbox.id, title: 'Inbox Q1', is_urgent: true, is_important: true })
    createTask({ list_id: work.id, title: 'Work Q1', is_urgent: true, is_important: true })

    expect(getTasksByQuadrant(inbox.id, 'q1-urgent-important').map((task) => task.id)).toEqual([inboxQ1.id])
  })

  it('throws for an invalid quadrant value', () => {
    const list = createList('Inbox')
    createTask({ list_id: list.id, title: 'Some task' })

    expect(() => getTasksByQuadrant(list.id, 'invalid-quadrant' as unknown as Parameters<typeof getTasksByQuadrant>[1])).toThrow(/invalid quadrant/i)
  })
})
