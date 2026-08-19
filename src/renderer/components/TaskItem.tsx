import { memo, useEffect } from 'react'
import type { TaskRow, Priority, Recurrence } from '../../shared/ipc'
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
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年'
}

const PRIORITY_LABELS: Record<Priority, string> = {
  low: '低',
  medium: '中',
  high: '高'
}

/**
 * Formats a `YYYY-MM-DD` date string as Simplified Chinese, e.g. `8月19日`.
 * Splits the string directly instead of `Date`/`Intl` so the result is
 * independent of the host timezone (a UTC-midnight parse would shift the day
 * in negative offsets) and of the OS locale. Unparseable input is returned
 * unchanged.
 */
export function formatChineseDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return dateStr
  return `${Number(match[2])}月${Number(match[3])}日`
}

function TaskItem({ task, onToggleComplete, onEdit, onDelete, dragHandleProps, renderCounter }: TaskItemProps) {
  useEffect(() => {
    renderCounter?.(task)
  })

  const isCompleted = task.completed === 1

  const handleDelete = async () => {
    if (window.confirm(`确定删除「${task.title}」吗？`)) {
      await onDelete(task.id)
    }
  }

  return (
    <li className="task-item" data-testid="task-item">
      {dragHandleProps && (
        <button
          className="task-drag-handle"
          data-testid="task-drag-handle"
          aria-label="拖动排序"
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
        aria-label={`将「${task.title}」标记为完成`}
        title={isCompleted ? '标记未完成' : '标记完成'}
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
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.due_date && (
            <span className="task-due-date" data-testid="task-due-date">
              {formatChineseDate(task.due_date)}
            </span>
          )}
          {task.recurrence && (
            <span className="task-badge task-badge-recurrence" data-testid="task-recurrence">
              {RECURRENCE_LABELS[task.recurrence]}
            </span>
          )}
          {(task.start_date || task.end_date) && (
            <span className="task-badge task-badge-duration" data-testid="task-duration">
              {task.start_date ? formatChineseDate(task.start_date) : '…'}
              {' → '}
              {task.end_date ? formatChineseDate(task.end_date) : '…'}
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
          title="编辑任务"
        >
          <Edit2 size={16} />
        </button>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          onClick={handleDelete}
          data-testid="task-delete-button"
          title="删除任务"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  )
}

export default memo(TaskItem)
