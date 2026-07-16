import { useState, useCallback } from 'react'
import type { TaskRow, CreateTaskInput, UpdateTaskInput } from '../../shared/ipc'
import TaskItem from './TaskItem'
import SortableTaskItem from './SortableTaskItem'
import { useSortableTasks } from '../hooks/useSortableTasks'
import TaskForm, { type TaskFormData } from './TaskForm'
interface TaskListProps {
  tasks: TaskRow[]
  selectedListId: number | null
  loading: boolean
  error: string | null
  onCreateTask: (input: CreateTaskInput) => Promise<void>
  onUpdateTask: (id: number, input: Partial<UpdateTaskInput>) => Promise<void>
  onDeleteTask: (id: number) => Promise<void>
  onToggleComplete: (task: TaskRow) => Promise<void>
  onReorder?: (reorderedTasks: TaskRow[]) => void
  showAddForm: boolean
  onOpenAddForm: () => void
  onCloseAddForm: () => void
  emptyMessage?: string
}

export default function TaskList({
  tasks,
  selectedListId,
  loading,
  error,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onToggleComplete,
  onReorder,
  showAddForm,
  onOpenAddForm,
  onCloseAddForm,
  emptyMessage
}: TaskListProps) {
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)
  const sortable = onReorder !== undefined && tasks.length > 1
  const { DndProvider } = useSortableTasks(
    tasks,
    selectedListId,
    onReorder ?? (() => {})
  )

  const handleCreate = async (data: TaskFormData) => {
    if (selectedListId === null) return
    await onCreateTask({
      list_id: selectedListId,
      title: data.title,
      description: data.description,
      priority: data.priority,
      due_date: data.due_date,
      reminder_at: data.reminder_at,
      recurrence: data.recurrence,
      recurrence_end_date: data.recurrence_end_date,
      start_date: data.start_date,
      end_date: data.end_date,
      is_urgent: data.is_urgent,
      is_important: data.is_important
    })
    onCloseAddForm()
  }

  const handleEdit = async (data: TaskFormData) => {
    if (!editingTask) return
    await onUpdateTask(editingTask.id, {
      title: data.title,
      description: data.description,
      priority: data.priority,
      due_date: data.due_date,
      reminder_at: data.reminder_at,
      recurrence: data.recurrence,
      recurrence_end_date: data.recurrence_end_date,
      start_date: data.start_date,
      end_date: data.end_date,
      is_urgent: data.is_urgent,
      is_important: data.is_important
    })
    setEditingTask(null)
  }

  const handleEditClick = useCallback((task: TaskRow) => {
    setEditingTask(task)
  }, [])

  if (selectedListId === null) {
    return (
      <div className="main-empty" data-testid="task-list-empty">
        Select a list to view tasks
      </div>
    )
  }

  return (
    <div className="main-content" data-testid="task-list-container">
      {error && (
        <div className="tasklist-card tasklist-card-error" data-testid="task-list-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="tasklist-card" data-testid="task-list-loading" role="status" aria-live="polite">
          <div className="tasklist-card-text">Loading tasks...</div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="tasklist-card" data-testid="task-list-empty">
          <div className="tasklist-card-text">{emptyMessage ?? 'No tasks yet'}</div>
          {!emptyMessage && (
            <button className="btn btn-primary" onClick={onOpenAddForm}>
              Add your first task
            </button>
          )}
        </div>
      ) : sortable ? (
        <DndProvider>
          <ul className="task-list" data-testid="task-list">
            {tasks.map((task) => (
              <SortableTaskItem
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onEdit={handleEditClick}
                onDelete={onDeleteTask}
              />
            ))}
          </ul>
        </DndProvider>
      ) : (
        <ul className="task-list" data-testid="task-list">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggleComplete={onToggleComplete}
              onEdit={handleEditClick}
              onDelete={onDeleteTask}
            />
          ))}
        </ul>
      )}

      {showAddForm && (
        <TaskForm
          listId={selectedListId}
          onSubmit={handleCreate}
          onCancel={onCloseAddForm}
        />
      )}

      {editingTask && (
        <TaskForm
          listId={selectedListId}
          task={editingTask}
          onSubmit={handleEdit}
          onCancel={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}
