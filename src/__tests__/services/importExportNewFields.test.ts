import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { closeDb } from '../../main/db/connection.js'
import { runMigrations } from '../../main/db/migrations.js'
import { createList } from '../../main/db/repositories/listRepository.js'
import { getAllLists } from '../../main/db/repositories/listRepository.js'
import {
  createTask,
  getTasksByListId,
} from '../../main/db/repositories/taskRepository.js'
import {
  exportToCsv,
  exportToJson,
  importFromCsv,
  importFromJson,
} from '../../main/services/importExport.js'

function createTempUserDataDir(): string {
  return fs.mkdtempSync(
    path.join(os.tmpdir(), 'todolist-import-export-new-fields-test-'),
  )
}

describe('importExport new fields', () => {
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

  it('exports JSON with recurrence, duration, and quadrant fields', () => {
    const work = createList('Work')
    createTask({
      list_id: work.id,
      title: 'Recurring task',
      priority: 'high',
      recurrence: 'daily',
      recurrence_end_date: '2024-12-31',
      start_date: '2024-01-01',
      end_date: '2024-01-07',
      is_urgent: true,
      is_important: true,
    })

    const json = exportToJson()
    const data = JSON.parse(json) as { tasks: unknown[] }
    const task = data.tasks[0] as {
      recurrence: string
      recurrenceEndDate: string
      startDate: string
      endDate: string
      isUrgent: boolean
      isImportant: boolean
    }

    expect(task.recurrence).toBe('daily')
    expect(task.recurrenceEndDate).toBe('2024-12-31')
    expect(task.startDate).toBe('2024-01-01')
    expect(task.endDate).toBe('2024-01-07')
    expect(task.isUrgent).toBe(true)
    expect(task.isImportant).toBe(true)
  })

  it('round-trips JSON preserving new fields', () => {
    const work = createList('Work')
    createTask({
      list_id: work.id,
      title: 'Original',
      priority: 'medium',
      recurrence: 'weekly',
      recurrence_end_date: '2024-06-30',
      start_date: '2024-01-01',
      end_date: '2024-01-14',
      is_urgent: true,
      is_important: false,
    })

    const json = exportToJson()
    importFromJson(json)

    const tasks = getTasksByListId(work.id)
    expect(tasks).toHaveLength(2)
    const imported = tasks.find((t) => t.title === 'Original')!
    expect(imported.recurrence).toBe('weekly')
    expect(imported.recurrence_end_date).toBe('2024-06-30')
    expect(imported.start_date).toBe('2024-01-01')
    expect(imported.end_date).toBe('2024-01-14')
    expect(imported.is_urgent).toBe(1)
    expect(imported.is_important).toBe(0)
  })

  it('imports legacy JSON without new fields using defaults', () => {
    const json = JSON.stringify({
      lists: [
        {
          id: 1,
          name: 'Legacy',
          createdAt: '2020-01-01T00:00:00.000Z',
          updatedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      tasks: [
        {
          listName: 'Legacy',
          title: 'Old task',
          description: null,
          priority: 'medium',
          dueDate: null,
          reminderAt: null,
          completed: false,
          sortOrder: 0,
        },
      ],
    })

    importFromJson(json)

    const lists = getAllLists()
    const tasks = getTasksByListId(lists[0].id)
    const task = tasks[0]
    expect(task.recurrence).toBeNull()
    expect(task.recurrence_end_date).toBeNull()
    expect(task.start_date).toBeNull()
    expect(task.end_date).toBeNull()
    expect(task.is_urgent).toBe(0)
    expect(task.is_important).toBe(0)
    expect(task.reminder_recurrence).toBe('once')
    expect(task.reminder_interval).toBeNull()
    expect(task.reminder_end_date).toBeNull()
    expect(task.reminder_follow_duration).toBe(0)
  })

  it('round-trips a repeating reminder rule through JSON', () => {
    const work = createList('Work')
    createTask({
      list_id: work.id,
      title: 'Pills',
      priority: 'medium',
      reminder_at: '2026-08-21T09:00',
      reminder_recurrence: 'everyN',
      reminder_interval: 3,
      reminder_end_date: '2026-12-31',
    })

    const json = exportToJson()
    importFromJson(json)

    const tasks = getTasksByListId(work.id)
    const imported = tasks.find((t) => t.title === 'Pills')!
    expect(imported.reminder_recurrence).toBe('everyN')
    expect(imported.reminder_interval).toBe(3)
    expect(imported.reminder_end_date).toBe('2026-12-31')
    expect(imported.reminder_follow_duration).toBe(0)
    expect(imported.reminder_time).toBe('09:00')
  })

  it('exports CSV with new headers', () => {
    const work = createList('Work')
    createTask({ list_id: work.id, title: 'Task', priority: 'low' })

    const csv = exportToCsv()
    const lines = csv.split('\n')

    expect(lines[0]).toBe(
      'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder,recurrence,recurrenceEndDate,startDate,endDate,isUrgent,isImportant,reminderRecurrence,reminderInterval,reminderEndDate,reminderFollowDuration',
    )
  })

  it('round-trips CSV preserving new fields', () => {
    const work = createList('Work')
    createTask({
      list_id: work.id,
      title: 'Original',
      priority: 'high',
      recurrence: 'monthly',
      recurrence_end_date: '2024-12-31',
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      is_urgent: false,
      is_important: true,
    })

    const csv = exportToCsv()
    importFromCsv(csv)

    const tasks = getTasksByListId(work.id)
    expect(tasks).toHaveLength(2)
    const imported = tasks.find((t) => t.title === 'Original')!
    expect(imported.recurrence).toBe('monthly')
    expect(imported.recurrence_end_date).toBe('2024-12-31')
    expect(imported.start_date).toBe('2024-01-01')
    expect(imported.end_date).toBe('2024-01-31')
    expect(imported.is_urgent).toBe(0)
    expect(imported.is_important).toBe(1)
  })

  it('imports legacy CSV without new fields using defaults', () => {
    const csv =
      'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder\nLegacy,Old task,,medium,,,false,0'

    importFromCsv(csv)

    const lists = getAllLists()
    const tasks = getTasksByListId(lists[0].id)
    const task = tasks[0]
    expect(task.recurrence).toBeNull()
    expect(task.recurrence_end_date).toBeNull()
    expect(task.start_date).toBeNull()
    expect(task.end_date).toBeNull()
    expect(task.is_urgent).toBe(0)
    expect(task.is_important).toBe(0)
    expect(task.reminder_recurrence).toBe('once')
    expect(task.reminder_interval).toBeNull()
    expect(task.reminder_end_date).toBeNull()
    expect(task.reminder_follow_duration).toBe(0)
  })

  it('round-trips a repeating reminder rule through CSV', () => {
    const work = createList('Work')
    createTask({
      list_id: work.id,
      title: 'Daily during task',
      priority: 'medium',
      reminder_at: '2026-08-21T09:00',
      reminder_recurrence: 'daily',
      reminder_follow_duration: true,
      start_date: '2026-08-01',
      end_date: '2026-08-31',
    })

    const csv = exportToCsv()
    importFromCsv(csv)

    const tasks = getTasksByListId(work.id)
    const imported = tasks.find((t) => t.title === 'Daily during task')!
    expect(imported.reminder_recurrence).toBe('daily')
    expect(imported.reminder_follow_duration).toBe(1)
    expect(imported.reminder_time).toBe('09:00')
  })

  it('rejects an everyN reminder without an interval on import', () => {
    const json = JSON.stringify({
      lists: [],
      tasks: [
        {
          listName: 'Work',
          title: 'Bad reminder',
          priority: 'medium',
          completed: false,
          reminderRecurrence: 'everyN',
        },
      ],
    })

    expect(() => importFromJson(json)).toThrow(
      /每 N 天提醒需要设置有效的间隔天数/,
    )
  })

  it('rejects invalid recurrence values', () => {
    const json = JSON.stringify({
      lists: [],
      tasks: [
        {
          listName: 'Work',
          title: 'Bad recurrence',
          priority: 'medium',
          completed: false,
          recurrence: 'hourly',
        },
      ],
    })

    expect(() => importFromJson(json)).toThrow(/无效的重复类型/)
  })

  it('rejects malformed date-only fields', () => {
    const json = JSON.stringify({
      lists: [],
      tasks: [
        {
          listName: 'Work',
          title: 'Bad date',
          priority: 'medium',
          completed: false,
          startDate: '2024-13-01',
        },
      ],
    })

    expect(() => importFromJson(json)).toThrow(/必须为有效的 YYYY-MM-DD/)
  })

  it('rejects startDate after endDate', () => {
    const json = JSON.stringify({
      lists: [],
      tasks: [
        {
          listName: 'Work',
          title: 'Inverted range',
          priority: 'medium',
          completed: false,
          startDate: '2024-02-01',
          endDate: '2024-01-01',
        },
      ],
    })

    expect(() => importFromJson(json)).toThrow(/开始日期不能晚于结束日期/)
  })

  it('rolls back the entire import when a new field is invalid', () => {
    const csv =
      'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder,recurrence,recurrenceEndDate,startDate,endDate,isUrgent,isImportant\n' +
      'Work,Valid,,medium,,,false,0,daily,2024-12-31,,,false,false\n' +
      'Work,Invalid,,medium,,,false,0,weekly,not-a-date,,,false,false'

    expect(() => importFromCsv(csv)).toThrow(/必须为有效的 YYYY-MM-DD/)
    expect(getAllLists()).toHaveLength(0)
  })

  it('rejects invalid recurrence values in CSV', () => {
    const csv =
      'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder,recurrence,recurrenceEndDate,startDate,endDate,isUrgent,isImportant\n' +
      'Work,Bad recurrence,,medium,,,false,0,hourly,,,,false,false'

    expect(() => importFromCsv(csv)).toThrow(/无效的重复类型/)
  })

  it('rejects malformed date-only fields in CSV', () => {
    const csv =
      'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder,recurrence,recurrenceEndDate,startDate,endDate,isUrgent,isImportant\n' +
      'Work,Bad date,,medium,,,false,0,daily,2024-13-01,,,false,false'

    expect(() => importFromCsv(csv)).toThrow(/必须为有效的 YYYY-MM-DD/)
  })

  it('rejects startDate after endDate in CSV', () => {
    const csv =
      'listName,title,description,priority,dueDate,reminderAt,completed,sortOrder,recurrence,recurrenceEndDate,startDate,endDate,isUrgent,isImportant\n' +
      'Work,Inverted range,,medium,,,false,0,,,2024-02-01,2024-01-01,false,false'

    expect(() => importFromCsv(csv)).toThrow(/开始日期不能晚于结束日期/)
  })
})
