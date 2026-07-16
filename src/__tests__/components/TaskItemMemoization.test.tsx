/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useState, useCallback } from 'react'
import TaskList from '../../renderer/components/TaskList'
import type { TaskRow } from '../../shared/ipc'

let globalRenderCounter: ((task: TaskRow) => void) | null = null

vi.mock('../../renderer/components/TaskItem', async () => {
  const actual = await vi.importActual<{
    default: React.ComponentType<{
      task: TaskRow
      onToggleComplete: (task: TaskRow) => Promise<void>
      onEdit: (task: TaskRow) => void
      onDelete: (id: number) => Promise<void>
      dragHandleProps?: Record<string, unknown>
      renderCounter?: (task: TaskRow) => void
    }>
  }>('../../renderer/components/TaskItem')
  const OriginalTaskItem = actual.default
  return {
    default: function TransparentTaskItem(props: {
      task: TaskRow
      onToggleComplete: (task: TaskRow) => Promise<void>
      onEdit: (task: TaskRow) => void
      onDelete: (id: number) => Promise<void>
      dragHandleProps?: Record<string, unknown>
      renderCounter?: (task: TaskRow) => void
    }) {
      return (
        <OriginalTaskItem
          {...props}
          renderCounter={globalRenderCounter ?? props.renderCounter}
        />
      )
    }
  }
})

const mockTasks: TaskRow[] = [
  {
    id: 1,
    list_id: 1,
    title: 'Task One',
    description: null,
    priority: 'medium',
    due_date: null,
    reminder_at: null,
    completed: 0,
    sort_order: 0,
    recurrence: null,
    recurrence_end_date: null,
    start_date: null,
    end_date: null,
    is_urgent: 0,
    is_important: 0,
    created_at: '',
    updated_at: ''
  },
  {
    id: 2,
    list_id: 1,
    title: 'Task Two',
    description: null,
    priority: 'medium',
    due_date: null,
    reminder_at: null,
    completed: 0,
    sort_order: 1,
    recurrence: null,
    recurrence_end_date: null,
    start_date: null,
    end_date: null,
    is_urgent: 0,
    is_important: 0,
    created_at: '',
    updated_at: ''
  },
  {
    id: 3,
    list_id: 1,
    title: 'Task Three',
    description: null,
    priority: 'medium',
    due_date: null,
    reminder_at: null,
    completed: 0,
    sort_order: 2,
    recurrence: null,
    recurrence_end_date: null,
    start_date: null,
    end_date: null,
    is_urgent: 0,
    is_important: 0,
    created_at: '',
    updated_at: ''
  }
]

function TestWrapper() {
  const [tasks, setTasks] = useState<TaskRow[]>(mockTasks)

  const handleToggleComplete = useCallback(async (task: TaskRow) => {
    setTasks((prev) => {
      const index = prev.findIndex((t) => t.id === task.id)
      if (index === -1) return prev
      const next = [...prev]
      next[index] = { ...next[index], completed: next[index].completed === 0 ? 1 : 0 }
      return next
    })
  }, [])

  const handleDeleteTask = useCallback(async () => {
    return Promise.resolve()
  }, [])

  const handleCreateTask = useCallback(async () => {
    return Promise.resolve()
  }, [])

  const handleUpdateTask = useCallback(async () => {
    return Promise.resolve()
  }, [])

  return (
    <TaskList
      tasks={tasks}
      selectedListId={1}
      loading={false}
      error={null}
      onCreateTask={handleCreateTask}
      onUpdateTask={handleUpdateTask}
      onDeleteTask={handleDeleteTask}
      onToggleComplete={handleToggleComplete}
      showAddForm={false}
      onOpenAddForm={() => {}}
      onCloseAddForm={() => {}}
    />
  )
}

describe('TaskItem memoization', () => {
  beforeEach(() => {
    globalRenderCounter = null
  })

  it('re-renders only the toggled task; siblings do not re-render', async () => {
    const renderCountsByTaskId = new Map<number, number>()

    const renderCounter = (task: TaskRow) => {
      renderCountsByTaskId.set(task.id, (renderCountsByTaskId.get(task.id) ?? 0) + 1)
    }

    globalRenderCounter = renderCounter

    render(<TestWrapper />)

    // Reset counts after initial mount so we only measure re-renders from the toggle
    renderCountsByTaskId.clear()

    const checkboxes = screen.getAllByTestId('task-checkbox')
    expect(checkboxes).toHaveLength(3)

    fireEvent.click(checkboxes[0])

    // Wait for async state update
    await new Promise((resolve) => setTimeout(resolve, 0))

    // The toggled task (id=1) should have re-rendered exactly once
    expect(renderCountsByTaskId.get(1)).toBe(1)
    // Siblings should not have re-rendered
    expect(renderCountsByTaskId.get(2)).toBeUndefined()
    expect(renderCountsByTaskId.get(3)).toBeUndefined()
  })
})
