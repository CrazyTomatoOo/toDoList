// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { closeDb, getDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createList } from '../../main/db/repositories/listRepository.js'
import {
  countTasksByList,
  createTask,
  getTasksByListId,
  searchTasks,
} from '../../main/db/repositories/taskRepository.js'
import { importFromJson } from '../../main/services/importExport.js'
import TaskList from '../../renderer/components/TaskList.js'
import type { TaskRow } from '../../shared/ipc.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'todolist-perf-test-'))
}

function elapsedMs(action: () => void): number {
  const start = performance.now()
  action()
  return performance.now() - start
}

function makeTask(index: number): Pick<TaskRow, 'id' | 'list_id' | 'title' | 'description' | 'priority' | 'due_date' | 'reminder_at' | 'completed' | 'sort_order' | 'created_at' | 'updated_at'> {
  const timestamp = new Date(2024, 0, 1).toISOString()
  return {
    id: index + 1,
    list_id: 1,
    title: `Task ${index}`,
    description: `Description ${index}`,
    priority: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low',
    due_date: null,
    reminder_at: null,
    completed: index % 2 === 0 ? 0 : 1,
    sort_order: index,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

describe('performance boundaries', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempUserDataDir()
    process.env.TODO_USER_DATA_DIR = tempDir
    runMigrations()
  })

  afterEach(() => {
    cleanup()
    closeDb()
    fs.rmSync(tempDir, { recursive: true, force: true })
    delete process.env.TODO_USER_DATA_DIR
  })

  it('bulk creates 1000 tasks via taskRepository in one transaction within 5 seconds', () => {
    const list = createList('Perf Inbox')

    const duration = elapsedMs(() => {
      getDb().transaction(() => {
        for (let i = 0; i < 1000; i++) {
          createTask({
            list_id: list.id,
            title: `Bulk task ${i}`,
            description: `Bulk description ${i}`,
            priority: i % 3 === 0 ? 'high' : 'medium',
          })
        }
      })()
    })

    expect(duration).toBeLessThan(5000)
    expect(countTasksByList(list.id)).toBe(1000)
  })

  it('lists, searches, and counts 1000 tasks in under 100ms per query', () => {
    const list = createList('Perf Inbox')
    getDb().transaction(() => {
      for (let i = 0; i < 1000; i++) {
        createTask({ list_id: list.id, title: `Findable task ${i}`, description: `needle ${i}` })
      }
    })()

    const listDuration = elapsedMs(() => {
      expect(getTasksByListId(list.id)).toHaveLength(1000)
    })
    const searchDuration = elapsedMs(() => {
      expect(searchTasks('needle 99', { listId: list.id }).length).toBeGreaterThan(0)
    })
    const countDuration = elapsedMs(() => {
      expect(countTasksByList(list.id)).toBe(1000)
    })

    expect(listDuration).toBeLessThan(100)
    expect(searchDuration).toBeLessThan(100)
    expect(countDuration).toBeLessThan(100)
  })

  it('imports 1000 tasks from JSON in under 5 seconds', () => {
    const payload = {
      lists: [{ id: 1, name: 'Imported Perf' }],
      tasks: Array.from({ length: 1000 }, (_, i) => ({
        listName: 'Imported Perf',
        title: `Imported task ${i}`,
        description: `Imported description ${i}`,
        priority: 'medium',
        completed: false,
      })),
    }

    const duration = elapsedMs(() => {
      expect(importFromJson(JSON.stringify(payload))).toEqual({ importedLists: 1, importedTasks: 1000 })
    })

    expect(duration).toBeLessThan(5000)
  })

  it('renders a 1000-task list without a real browser', () => {
    const tasks = Array.from({ length: 1000 }, (_, i) => makeTask(i) as TaskRow)

    const duration = elapsedMs(() => {
      render(
        React.createElement(TaskList, {
          tasks,
          selectedListId: 1,
          loading: false,
          error: null,
          onCreateTask: async () => {},
          onUpdateTask: async () => {},
          onDeleteTask: async () => {},
          onToggleComplete: async () => {},
          onReorder: () => {},
          showAddForm: false,
          onOpenAddForm: () => {},
          onCloseAddForm: () => {},
        }),
      )
    })

    expect(screen.getAllByTestId('task-item')).toHaveLength(1000)
    expect(duration).toBeLessThan(1500)
  })
})
