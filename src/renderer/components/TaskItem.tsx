import { memo, useEffect } from 'react'
import type { TaskRow, Recurrence } from '../../shared/ipc'
import { Edit2, Trash2, GripVertical } from 'lucide-react'

interface TaskItemProps {
  task: TaskRow
  onToggleComplete: (task: TaskRow) => Promise<void>
  onEdit: (task: TaskRow) => void
  onDelete: (id: number) => Promise<void>
  dragHandleProps?: Record<string, unknown>
  renderCounter?: (task: TaskRow) => void
}

/**
 * Maps is_urgent and is_important flags to Eisenhower quadrant labels.
 * Q1 = urgent & important, Q2 = not urgent & important,
 * Q3 = urgent & not important, Q4 = not urgent & not important.
 */
export function getQuadrantLabel(isUrgent: 0 | 1, isImportant: 0 | 1): string {
  if (isUrgent === 1 && isImportant === 1) return 'Q1'
  if (isUrgent === 0 && isImportant === 1) return 'Q2'
  if (isUrgent === 1 && isImportant === 0) return 'Q3'
  return 'Q4'
}

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly'
}

function TaskItem({ task, onToggleComplete, onEdit, onDelete, dragHandleProps, renderCounter }: TaskItemProps) {
  useEffect(() => {
    renderCounter?.(task)
  })

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
          <GripVertical size={16} />
        </button>
      )}
      <button
        className={`task-checkbox${isCompleted ? ' checked' : ''}`}
        onClick={() => onToggleComplete(task)}
        data-testid="task-checkbox"
        role="checkbox"
        aria-checked={isCompleted}
        aria-label={`Mark ${task.title} complete`}
        title={isCompleted ? 'Mark incomplete' : 'Mark complete'}
      />

      <div className="task-item-body">
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
          {task.recurrence && (
            <span className="task-badge task-badge-recurrence" data-testid="task-recurrence">
              {RECURRENCE_LABELS[task.recurrence]}
            </span>
          )}
          {(task.start_date || task.end_date) && (
            <span className="task-badge task-badge-duration" data-testid="task-duration">
              {task.start_date ? formatDate(task.start_date) : '…'}
              {' → '}
              {task.end_date ? formatDate(task.end_date) : '…'}
            </span>
          )}
          <span className="task-badge task-badge-quadrant" data-testid="task-quadrant">
            {getQuadrantLabel(task.is_urgent, task.is_important)}
          </span>
        </div>
      </div>

      <div className="task-actions">
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => onEdit(task)}
          data-testid="task-edit-button"
          title="Edit task"
        >
          <Edit2 size={16} />
        </button>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={handleDelete}
          data-testid="task-delete-button"
          title="Delete task"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  )
}

export default memo(TaskItem)
