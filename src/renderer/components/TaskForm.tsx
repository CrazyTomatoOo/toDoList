import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type {
  TaskRow,
  Priority,
  Recurrence,
  ReminderRecurrence,
} from '../../shared/ipc'
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
  reminder_recurrence: ReminderRecurrence
  reminder_interval: number | null
  reminder_end_date: string | null
  reminder_follow_duration: boolean
  recurrence: Recurrence | null
  recurrence_end_date: string | null
  start_date: string | null
  end_date: string | null
  is_urgent: boolean
  is_important: boolean
}

/**
 * The next local `YYYY-MM-DDTHH:MM` at or after the given time-of-day. Used to
 * compute a repeating reminder's first fire from its trigger time. `now` is
 * injectable for deterministic tests.
 */
export function nextTimeOccurrence(
  hhmm: string,
  now: Date = new Date(),
): string {
  const [hour, minute] = hhmm.split(':').map(Number)
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hour,
    minute,
  )
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1)
  }
  const month = String(candidate.getMonth() + 1).padStart(2, '0')
  const day = String(candidate.getDate()).padStart(2, '0')
  return `${candidate.getFullYear()}-${month}-${day}T${hhmm}`
}

/**
 * Materialized next fire for a repeating rule: keep the already-scheduled
 * reminder when editing without changing the rule's time-of-day, otherwise
 * derive the next occurrence of the trigger time.
 */
function repeatingReminderAt(
  task: TaskRow | null | undefined,
  time: string,
): string {
  const scheduledTime =
    task?.reminder_time ??
    (task?.reminder_at ? task.reminder_at.slice(11, 16) : null)
  if (task?.reminder_at && scheduledTime === time) {
    return task.reminder_at
  }
  return nextTimeOccurrence(time)
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
  const [reminderTime, setReminderTime] = useState(
    task?.reminder_time ??
      (task?.reminder_at ? task.reminder_at.slice(11, 16) : ''),
  )
  const [reminderRecurrence, setReminderRecurrence] =
    useState<ReminderRecurrence>(task?.reminder_recurrence ?? 'once')
  const [reminderInterval, setReminderInterval] = useState(
    task?.reminder_interval != null ? String(task.reminder_interval) : '',
  )
  const [reminderBoundary, setReminderBoundary] = useState<
    'none' | 'endDate' | 'followDuration'
  >(() => {
    if (task?.reminder_follow_duration === 1) return 'followDuration'
    if (task?.reminder_end_date) return 'endDate'
    return 'none'
  })
  const [reminderEndDate, setReminderEndDate] = useState(
    task?.reminder_end_date ?? '',
  )
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

    if (reminderRecurrence === 'everyN') {
      const n = Number(reminderInterval)
      if (!Number.isInteger(n) || n < 1 || n > 365) {
        setError('每 N 天提醒需要设置有效的间隔天数（1-365）')
        return false
      }
    }

    if (reminderRecurrence !== 'once' && reminderBoundary === 'endDate') {
      try {
        validateDateOnly(reminderEndDate || null, '提醒结束日期')
      } catch (err) {
        setError(err instanceof Error ? err.message : '无效日期')
        return false
      }
    }

    if (
      reminderRecurrence !== 'once' &&
      reminderBoundary === 'followDuration'
    ) {
      if (!startDate || !endDate) {
        setError('跟随持续期的提醒需要任务设置开始和结束日期')
        return false
      }
    }

    if (reminderRecurrence !== 'once') {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(reminderTime)) {
        setError('请设置提醒时刻')
        return false
      }
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
      const reminderAtValue =
        reminderRecurrence === 'once'
          ? reminderAt || null
          : repeatingReminderAt(task, reminderTime)
      await onSubmit({
        title: trimmedTitle,
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        reminder_at: reminderAtValue,
        reminder_recurrence: reminderRecurrence,
        reminder_interval:
          reminderRecurrence === 'everyN' ? Number(reminderInterval) : null,
        reminder_end_date:
          reminderRecurrence !== 'once' && reminderBoundary === 'endDate'
            ? reminderEndDate || null
            : null,
        reminder_follow_duration:
          reminderRecurrence !== 'once' &&
          reminderBoundary === 'followDuration',
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
              {reminderRecurrence === 'once' ? (
                <>
                  <label className="form-label" htmlFor="task-reminder">
                    提醒时间
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
                </>
              ) : (
                <>
                  <label className="form-label" htmlFor="task-reminder-time">
                    提醒时刻
                  </label>
                  <input
                    id="task-reminder-time"
                    className="form-input"
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    disabled={submitting}
                    data-testid="task-form-reminder-time"
                  />
                </>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="task-reminder-recurrence"
                >
                  提醒重复
                </label>
                <select
                  id="task-reminder-recurrence"
                  className="form-input"
                  value={reminderRecurrence}
                  onChange={(e) =>
                    setReminderRecurrence(e.target.value as ReminderRecurrence)
                  }
                  disabled={submitting}
                  data-testid="task-form-reminder-recurrence"
                >
                  <option value="once">不重复</option>
                  <option value="daily">每天</option>
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                  <option value="yearly">每年</option>
                  <option value="everyN">每 N 天</option>
                </select>
              </div>
              {reminderRecurrence === 'everyN' && (
                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="task-reminder-interval"
                  >
                    间隔天数
                  </label>
                  <input
                    id="task-reminder-interval"
                    className="form-input"
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={reminderInterval}
                    onChange={(e) => setReminderInterval(e.target.value)}
                    disabled={submitting}
                    data-testid="task-form-reminder-interval"
                  />
                </div>
              )}
            </div>
            {reminderRecurrence !== 'once' && (
              <div className="form-row">
                <div className="form-group">
                  <label
                    className="form-label"
                    htmlFor="task-reminder-boundary"
                  >
                    提醒边界
                  </label>
                  <select
                    id="task-reminder-boundary"
                    className="form-input"
                    value={reminderBoundary}
                    onChange={(e) =>
                      setReminderBoundary(
                        e.target.value as 'none' | 'endDate' | 'followDuration',
                      )
                    }
                    disabled={submitting}
                    data-testid="task-form-reminder-boundary"
                  >
                    <option value="none">无</option>
                    <option value="endDate">结束日期</option>
                    <option
                      value="followDuration"
                      disabled={!startDate || !endDate}
                    >
                      跟随持续期
                    </option>
                  </select>
                </div>
                {reminderBoundary === 'endDate' && (
                  <div className="form-group">
                    <label
                      className="form-label"
                      htmlFor="task-reminder-end-date"
                    >
                      提醒结束日期
                    </label>
                    <DatePicker
                      value={reminderEndDate || null}
                      onChange={setReminderEndDate}
                      disabled={submitting}
                      id="task-reminder-end-date"
                      testid="task-form-reminder-end-date"
                      placeholder="年/月/日"
                    />
                  </div>
                )}
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
