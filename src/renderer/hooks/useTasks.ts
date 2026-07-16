import { useState, useEffect, useCallback } from 'react'
import type { TaskRow, CreateTaskInput, UpdateTaskInput } from '../../shared/ipc'

interface UseTasksReturn {
  tasks: TaskRow[]
  loading: boolean
  error: string | null
  createTask: (input: CreateTaskInput) => Promise<TaskRow>
  updateTask: (id: number, input: Partial<UpdateTaskInput>) => Promise<TaskRow>
  deleteTask: (id: number) => Promise<void>
  toggleComplete: (task: TaskRow) => Promise<TaskRow>
  refresh: () => Promise<void>
}

export function useTasks(selectedListId: number | null): UseTasksReturn {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (selectedListId === null) {
      setTasks([])
      return
    }
    try {
      setLoading(true)
      setError(null)
      const result = await window.electronAPI.tasks.getByListId(selectedListId)
      setTasks(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [selectedListId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createTask = useCallback(async (input: CreateTaskInput): Promise<TaskRow> => {
    const result = await window.electronAPI.tasks.create(input)
    await refresh()
    return result
  }, [refresh])

  const updateTask = useCallback(
    async (id: number, input: Partial<UpdateTaskInput>): Promise<TaskRow> => {
      const result = await window.electronAPI.tasks.update(id, input)
      await refresh()
      return result
    },
    [refresh]
  )

  const deleteTask = useCallback(async (id: number): Promise<void> => {
    await window.electronAPI.tasks.delete(id)
    await refresh()
  }, [refresh])

  const toggleComplete = useCallback(
    async (task: TaskRow): Promise<TaskRow> => {
      const result = await window.electronAPI.tasks.update(task.id, {
        completed: task.completed === 0
      })
      await refresh()
      return result
    },
    [refresh]
  )

  return { tasks, loading, error, createTask, updateTask, deleteTask, toggleComplete, refresh }
}
