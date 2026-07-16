import type { TaskRow } from '../../shared/ipc'

interface TaskItemProps {
  task: TaskRow
  onToggleComplete: (task: TaskRow) => Promise<void>
  onEdit: (task: TaskRow) => void
  onDelete: (id: number) => Promise<void>
  dragHandleProps?: Record<string, unknown>
}

export default function TaskItem({ task, onToggleComplete, onEdit, onDelete, dragHandleProps }: TaskItemProps) {
  const isCompleted = task.completed === 1

  const handleDelete = async () => {
    if (window.confirm(`Delete "${task.title}"?`)) {
      await onDelete(task.id)
    }
  }

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <li className="task-item" data-testid="task-item">
      {dragHandleProps && (
        <button
          className="task-drag-handle"
          data-testid="task-drag-handle"
          aria-label="Drag to reorder"
          {...dragHandleProps}
        >
          ⠿
        </button>
      )}
      <button
        className={`task-checkbox${isCompleted ? ' checked' : ''}`}
        onClick={() => onToggleComplete(task)}
        data-testid="task-checkbox"
        role="checkbox"
        aria-checked={isCompleted}
        title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      />

      <div className="task-item-body" onClick={() => onEdit(task)} style={{ cursor: 'pointer' }}>
        <div
          className={`task-title${isCompleted ? ' completed' : ''}`}
          data-testid="task-title"
        >
          {task.title}
        </div>
        <div className="task-meta">
          <span className={`task-priority ${task.priority}`} data-testid="task-priority">
            {task.priority}
          </span>
          {task.due_date && (
            <span className="task-due-date" data-testid="task-due-date">
              {formatDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      <div className="task-actions">
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => onEdit(task)}
          data-testid="task-edit-button"
          title="Edit task"
        >
          ✎
        </button>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={handleDelete}
          data-testid="task-delete-button"
          title="Delete task"
        >
          ×
        </button>
      </div>
    </li>
  )
}
