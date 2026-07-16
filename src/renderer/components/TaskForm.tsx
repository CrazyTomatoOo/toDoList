import { useState, type FormEvent } from 'react'
import type { TaskRow, Priority } from '../../shared/ipc'

interface TaskFormProps {
  listId: number
  task?: TaskRow | null
  onSubmit: (data: TaskFormData) => Promise<void>
  onCancel: () => void
}

export interface TaskFormData {
  title: string
  description: string | null
  priority: Priority
  due_date: string | null
  reminder_at: string | null
}

export default function TaskForm({ listId, task, onSubmit, onCancel }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [reminderAt, setReminderAt] = useState(task?.reminder_at ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isEdit = !!task

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setError('Title is required')
      return
    }
    if (trimmedTitle.length > 200) {
      setError('Title must be 200 characters or less')
      return
    }
    if (description.length > 2000) {
      setError('Description must be 2000 characters or less')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        reminder_at: reminderAt || null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task')
    } finally {
      setSubmitting(false)
    }
  }

  // Suppress unused variable warning — listId is used by the parent for create
  void listId

  return (
    <div className="modal-overlay" onClick={onCancel} data-testid="task-form-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onCancel} data-testid="task-form-close">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} data-testid="task-form">
          <div className="form-group">
            <label className="form-label" htmlFor="task-title">
              Title *
            </label>
            <input
              id="task-title"
              className="form-input"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setError(null)
              }}
              placeholder="What needs to be done?"
              autoFocus
              disabled={submitting}
              maxLength={200}
              data-testid="task-form-title"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-description">
              Description
            </label>
            <textarea
              id="task-description"
              className="form-input form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              disabled={submitting}
              maxLength={2000}
              data-testid="task-form-description"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="task-priority">
                Priority
              </label>
              <select
                id="task-priority"
                className="form-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                disabled={submitting}
                data-testid="task-form-priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-due-date">
                Due Date
              </label>
              <input
                id="task-due-date"
                className="form-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={submitting}
                data-testid="task-form-due-date"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="task-reminder">
              Reminder
            </label>
            <input
              id="task-reminder"
              className="form-input"
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
              disabled={submitting}
              data-testid="task-form-reminder"
            />
          </div>

          {error && (
            <div className="form-error" data-testid="task-form-error">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onCancel}
              disabled={submitting}
              data-testid="task-form-cancel"
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
              data-testid="task-form-save"
            >
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
