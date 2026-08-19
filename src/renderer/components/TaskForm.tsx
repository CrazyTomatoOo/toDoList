import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { TaskRow, Priority, Recurrence } from '../../shared/ipc'
import { validateDateOnly } from '../../shared/utils/dateValidator'
import RecurrenceFields from './RecurrenceFields'
import DurationFields from './DurationFields'
import QuadrantFlags from './QuadrantFlags'
import DatePicker from './DatePicker'

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
  recurrence: Recurrence | null
  recurrence_end_date: string | null
  start_date: string | null
  end_date: string | null
  is_urgent: boolean
  is_important: boolean
}

export default function TaskForm({
  listId,
  task,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(task?.due_date ?? '')
  const [reminderAt, setReminderAt] = useState(task?.reminder_at ?? '')
  const [recurrence, setRecurrence] = useState<Recurrence | ''>(
    task?.recurrence ?? '',
  )
  const [recurrenceEndDate, setRecurrenceEndDate] = useState(
    task?.recurrence_end_date ?? '',
  )
  const [startDate, setStartDate] = useState(task?.start_date ?? '')
  const [endDate, setEndDate] = useState(task?.end_date ?? '')
  const [isUrgent, setIsUrgent] = useState(task?.is_urgent === 1)
  const [isImportant, setIsImportant] = useState(task?.is_important === 1)
  const [error, setError] = useState<string | null>(null)
  const [durationError, setDurationError] = useState<string | null>(null)
  const [recurrenceError, setRecurrenceError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const titleId = 'task-form-title-heading'

  const isEdit = !!task

  // Focus trap + Escape + focus restoration
  useEffect(() => {
    triggerRef.current = document.activeElement

    // Focus first focusable element in modal
    const timer = requestAnimationFrame(() => {
      const modal = modalRef.current
      if (!modal) return
      const focusable = modal.querySelector<HTMLElement>(
        'button, [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }

      if (e.key === 'Tab') {
        const modal = modalRef.current
        if (!modal) return
        const focusableEls = modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusableEls.length === 0) return
        const firstEl = focusableEls[0]
        const lastEl = focusableEls[focusableEls.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstEl) {
            e.preventDefault()
            lastEl.focus()
          }
        } else {
          if (document.activeElement === lastEl) {
            e.preventDefault()
            firstEl.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(timer)
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus to trigger element
      const trigger = triggerRef.current
      if (trigger && trigger instanceof HTMLElement) {
        requestAnimationFrame(() => trigger.focus())
      }
    }
  }, [onCancel])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onCancel()
    },
    [onCancel],
  )

  const validate = (): boolean => {
    setDurationError(null)
    setRecurrenceError(null)

    try {
      validateDateOnly(startDate || null, '开始日期')
      validateDateOnly(endDate || null, '结束日期')
      validateDateOnly(recurrenceEndDate || null, '重复结束日期')
    } catch (err) {
      setError(err instanceof Error ? err.message : '无效日期')
      return false
    }

    if (startDate && endDate && startDate > endDate) {
      setDurationError('开始日期不能晚于结束日期')
      return false
    }

    if (recurrence && !dueDate && !startDate) {
      setRecurrenceError('重复任务需要截止日期或开始日期')
      return false
    }

    return true
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setError('请输入标题')
      return
    }
    if (trimmedTitle.length > 200) {
      setError('标题不能超过 200 个字符')
      return
    }
    if (description.length > 2000) {
      setError('描述不能超过 2000 个字符')
      return
    }

    if (!validate()) {
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
        reminder_at: reminderAt || null,
        recurrence: recurrence || null,
        recurrence_end_date: recurrenceEndDate || null,
        start_date: startDate || null,
        end_date: endDate || null,
        is_urgent: isUrgent,
        is_important: isImportant,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存任务失败')
    } finally {
      setSubmitting(false)
    }
  }

  // Suppress unused variable warning — listId is used by the parent for create
  void listId
  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      data-testid="task-form-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="modal-content" ref={modalRef}>
        <div className="modal-header">
          <h2 id={titleId}>{isEdit ? '编辑任务' : '新建任务'}</h2>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onCancel}
            data-testid="task-form-close"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {error && (
            <div
              className="form-error-top"
              role="alert"
              aria-live="polite"
              data-testid="task-form-error"
            >
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} data-testid="task-form" noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="task-title">
                标题 *
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
                placeholder="需要做什么？"
                autoFocus
                disabled={submitting}
                maxLength={200}
                data-testid="task-form-title"
                aria-invalid={
                  !!error &&
                  (error === '请输入标题' ||
                    error === '标题不能超过 200 个字符')
                }
                aria-describedby={error ? 'task-form-error-msg' : undefined}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="task-description">
                描述
              </label>
              <textarea
                id="task-description"
                className="form-input form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="添加详情…"
                disabled={submitting}
                maxLength={2000}
                data-testid="task-form-description"
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="task-priority">
                  优先级
                </label>
                <select
                  id="task-priority"
                  className="form-input"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  disabled={submitting}
                  data-testid="task-form-priority"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="task-due-date">
                  截止日期
                </label>
                <DatePicker
                  value={dueDate || null}
                  onChange={setDueDate}
                  disabled={submitting}
                  id="task-due-date"
                  testid="task-form-due-date"
                  placeholder="年/月/日"
                />
              </div>
            </div>
            <RecurrenceFields
              recurrence={recurrence}
              recurrenceEndDate={recurrenceEndDate}
              disabled={submitting}
              onRecurrenceChange={setRecurrence}
              onRecurrenceEndDateChange={setRecurrenceEndDate}
            />
            {recurrenceError && (
              <div
                className="form-error"
                role="alert"
                aria-live="polite"
                data-testid="task-form-recurrence-error"
              >
                {recurrenceError}
              </div>
            )}
            <DurationFields
              startDate={startDate}
              endDate={endDate}
              disabled={submitting}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              error={durationError}
            />
            <QuadrantFlags
              isUrgent={isUrgent}
              isImportant={isImportant}
              disabled={submitting}
              onUrgentChange={setIsUrgent}
              onImportantChange={setIsImportant}
            />
            <div className="form-group">
              <label className="form-label" htmlFor="task-reminder">
                提醒
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
            <div className="form-actions">
              <button
                className="btn btn-secondary"
                type="button"
                onClick={onCancel}
                disabled={submitting}
                data-testid="task-form-cancel"
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={submitting}
                data-testid="task-form-save"
              >
                {submitting ? '保存中…' : isEdit ? '更新' : '创建'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
