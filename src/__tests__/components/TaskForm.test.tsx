/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

import TaskForm from '../../renderer/components/TaskForm'
import type { TaskRow } from '../../shared/ipc'

const createMockTask = (overrides: Partial<TaskRow> = {}): TaskRow => ({
  id: 1,
  list_id: 1,
  title: 'Test Task',
  description: null,
  priority: 'medium',
  due_date: null,
  reminder_at: null,
  reminder_recurrence: 'once',
  reminder_interval: null,
  reminder_end_date: null,
  reminder_follow_duration: 0,
  reminder_time: null,
  completed: 0,
  sort_order: 0,
  recurrence: null,
  recurrence_end_date: null,
  start_date: null,
  end_date: null,
  is_urgent: 0,
  is_important: 0,
  created_at: '',
  updated_at: '',
  ...overrides,
})

const defaultProps = {
  listId: 1,
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
}

describe('TaskForm', () => {
  describe('new fields rendering', () => {
    it('renders recurrence select with all options', () => {
      render(<TaskForm {...defaultProps} />)
      const select = screen.getByTestId('task-form-recurrence')
      expect(select).toBeInTheDocument()
      const options = Array.from(select.querySelectorAll('option')).map(
        (option) => option.textContent,
      )
      expect(options).toEqual(['不重复', '每天', '每周', '每月', '每年'])
    })

    it('renders start date and end date inputs', () => {
      render(<TaskForm {...defaultProps} />)
      expect(screen.getByTestId('task-form-start-date')).toBeInTheDocument()
      expect(screen.getByTestId('task-form-end-date')).toBeInTheDocument()
    })

    it('renders urgent and important checkboxes', () => {
      render(<TaskForm {...defaultProps} />)
      expect(screen.getByTestId('task-form-urgent')).toBeInTheDocument()
      expect(screen.getByTestId('task-form-important')).toBeInTheDocument()
    })

    it('shows recurrence end date when recurrence is selected', async () => {
      render(<TaskForm {...defaultProps} />)
      const select = screen.getByTestId('task-form-recurrence')
      fireEvent.change(select, { target: { value: 'daily' } })
      await waitFor(() => {
        expect(
          screen.getByTestId('task-form-recurrence-end-date'),
        ).toBeInTheDocument()
      })
    })

    it('pre-fills fields from existing task', () => {
      const task = createMockTask({
        recurrence: 'weekly',
        recurrence_end_date: '2026-12-31',
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        is_urgent: 1,
        is_important: 1,
      })
      render(<TaskForm {...defaultProps} task={task} />)

      const recurrenceSelect = screen.getByTestId(
        'task-form-recurrence',
      ) as HTMLSelectElement
      expect(recurrenceSelect.value).toBe('weekly')

      const recurrenceEndDate = screen.getByTestId(
        'task-form-recurrence-end-date',
      ) as HTMLInputElement
      expect(recurrenceEndDate.value).toBe('2026-12-31')

      const startDate = screen.getByTestId(
        'task-form-start-date',
      ) as HTMLInputElement
      expect(startDate.value).toBe('2026-01-01')

      const endDate = screen.getByTestId(
        'task-form-end-date',
      ) as HTMLInputElement
      expect(endDate.value).toBe('2026-01-31')

      const urgent = screen.getByTestId('task-form-urgent') as HTMLInputElement
      expect(urgent.checked).toBe(true)

      const important = screen.getByTestId(
        'task-form-important',
      ) as HTMLInputElement
      expect(important.checked).toBe(true)
    })
  })

  describe('reminder rule controls', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('renders the reminder recurrence select with all options', () => {
      render(<TaskForm {...defaultProps} />)
      const select = screen.getByTestId('task-form-reminder-recurrence')
      expect(select).toBeInTheDocument()
      const options = Array.from(select.querySelectorAll('option')).map(
        (option) => option.textContent,
      )
      expect(options).toEqual([
        '不重复',
        '每天',
        '每周',
        '每月',
        '每年',
        '每 N 天',
      ])
    })

    it('shows the interval input only for everyN cadence', () => {
      render(<TaskForm {...defaultProps} />)
      expect(
        screen.queryByTestId('task-form-reminder-interval'),
      ).not.toBeInTheDocument()

      fireEvent.change(screen.getByTestId('task-form-reminder-recurrence'), {
        target: { value: 'everyN' },
      })
      expect(
        screen.getByTestId('task-form-reminder-interval'),
      ).toBeInTheDocument()
    })

    it('shows boundary controls only for repeating rules', () => {
      render(<TaskForm {...defaultProps} />)
      expect(
        screen.queryByTestId('task-form-reminder-boundary'),
      ).not.toBeInTheDocument()

      fireEvent.change(screen.getByTestId('task-form-reminder-recurrence'), {
        target: { value: 'daily' },
      })
      expect(
        screen.getByTestId('task-form-reminder-boundary'),
      ).toBeInTheDocument()
    })

    it('disables follow-duration option until the task has a duration', () => {
      render(<TaskForm {...defaultProps} />)
      fireEvent.change(screen.getByTestId('task-form-reminder-recurrence'), {
        target: { value: 'daily' },
      })

      const boundary = screen.getByTestId(
        'task-form-reminder-boundary',
      ) as HTMLSelectElement
      const followOption = boundary.querySelector(
        'option[value="followDuration"]',
      ) as HTMLOptionElement
      expect(followOption.disabled).toBe(true)

      fireEvent.change(screen.getByTestId('task-form-start-date'), {
        target: { value: '2026-08-01' },
      })
      fireEvent.change(screen.getByTestId('task-form-end-date'), {
        target: { value: '2026-08-31' },
      })
      expect(followOption.disabled).toBe(false)
    })

    it('blocks submission when everyN has no interval', async () => {
      render(<TaskForm {...defaultProps} />)
      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-reminder-recurrence'), {
        target: { value: 'everyN' },
      })

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(screen.getByTestId('task-form-error')).toHaveTextContent(
          '每 N 天提醒需要设置有效的间隔天数（1-365）',
        )
      })
      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('blocks submission when follow-duration reminder has no task duration', async () => {
      render(<TaskForm {...defaultProps} />)
      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-reminder-recurrence'), {
        target: { value: 'daily' },
      })
      fireEvent.change(screen.getByTestId('task-form-reminder-boundary'), {
        target: { value: 'followDuration' },
      })

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(screen.getByTestId('task-form-error')).toHaveTextContent(
          '跟随持续期的提醒需要任务设置开始和结束日期',
        )
      })
      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('submits a repeating reminder rule', async () => {
      render(<TaskForm {...defaultProps} />)
      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-reminder'), {
        target: { value: '2026-08-21T09:00' },
      })
      fireEvent.change(screen.getByTestId('task-form-reminder-recurrence'), {
        target: { value: 'everyN' },
      })
      fireEvent.change(screen.getByTestId('task-form-reminder-interval'), {
        target: { value: '3' },
      })
      fireEvent.change(screen.getByTestId('task-form-reminder-boundary'), {
        target: { value: 'endDate' },
      })
      fireEvent.change(screen.getByTestId('task-form-reminder-end-date'), {
        target: { value: '2026-08-31' },
      })

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test',
            reminder_at: '2026-08-21T09:00',
            reminder_recurrence: 'everyN',
            reminder_interval: 3,
            reminder_end_date: '2026-08-31',
            reminder_follow_duration: false,
          }),
        )
      })
    })
  })

  describe('validation', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('blocks submission when start_date > end_date', async () => {
      render(<TaskForm {...defaultProps} />)

      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-start-date'), {
        target: { value: '2026-12-31' },
      })
      fireEvent.change(screen.getByTestId('task-form-end-date'), {
        target: { value: '2026-01-01' },
      })

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(
          screen.getByTestId('task-form-duration-error'),
        ).toHaveTextContent('开始日期不能晚于结束日期')
      })

      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('blocks submission when recurrence is set without due_date or start_date', async () => {
      render(<TaskForm {...defaultProps} />)

      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), {
        target: { value: 'daily' },
      })

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(
          screen.getByTestId('task-form-recurrence-error'),
        ).toHaveTextContent('重复任务需要截止日期或开始日期')
      })

      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('allows submission when recurrence is set with due_date', async () => {
      render(<TaskForm {...defaultProps} />)

      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), {
        target: { value: 'daily' },
      })
      fireEvent.change(screen.getByTestId('task-form-due-date'), {
        target: { value: '2026-07-16' },
      })

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test',
            recurrence: 'daily',
            due_date: '2026-07-16',
          }),
        )
      })
    })

    it('allows submission when recurrence is set with start_date', async () => {
      render(<TaskForm {...defaultProps} />)

      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), {
        target: { value: 'weekly' },
      })
      fireEvent.change(screen.getByTestId('task-form-start-date'), {
        target: { value: '2026-07-16' },
      })

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test',
            recurrence: 'weekly',
            start_date: '2026-07-16',
          }),
        )
      })
    })

    it('submits all new fields correctly', async () => {
      render(<TaskForm {...defaultProps} />)

      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test Task' },
      })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), {
        target: { value: 'monthly' },
      })
      fireEvent.change(screen.getByTestId('task-form-recurrence-end-date'), {
        target: { value: '2026-12-31' },
      })
      fireEvent.change(screen.getByTestId('task-form-start-date'), {
        target: { value: '2026-01-01' },
      })
      fireEvent.change(screen.getByTestId('task-form-end-date'), {
        target: { value: '2026-01-31' },
      })
      fireEvent.click(screen.getByTestId('task-form-urgent'))
      fireEvent.click(screen.getByTestId('task-form-important'))

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith({
          title: 'Test Task',
          description: null,
          priority: 'medium',
          due_date: null,
          reminder_at: null,
          reminder_recurrence: 'once',
          reminder_interval: null,
          reminder_end_date: null,
          reminder_follow_duration: false,
          recurrence: 'monthly',
          recurrence_end_date: '2026-12-31',
          start_date: '2026-01-01',
          end_date: '2026-01-31',
          is_urgent: true,
          is_important: true,
        })
      })
    })
  })

  describe('additional edge cases', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('blocks submission when start_date > end_date with recurrence set', async () => {
      render(<TaskForm {...defaultProps} />)

      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), {
        target: { value: 'daily' },
      })
      fireEvent.change(screen.getByTestId('task-form-due-date'), {
        target: { value: '2026-07-16' },
      })
      fireEvent.change(screen.getByTestId('task-form-start-date'), {
        target: { value: '2026-12-31' },
      })
      fireEvent.change(screen.getByTestId('task-form-end-date'), {
        target: { value: '2026-01-01' },
      })

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(
          screen.getByTestId('task-form-duration-error'),
        ).toHaveTextContent('开始日期不能晚于结束日期')
      })

      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('allows submission when recurrence is set with start_date only', async () => {
      render(<TaskForm {...defaultProps} />)

      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), {
        target: { value: 'daily' },
      })
      fireEvent.change(screen.getByTestId('task-form-start-date'), {
        target: { value: '2026-07-16' },
      })

      fireEvent.click(screen.getByTestId('task-form-save'))

      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test',
            recurrence: 'daily',
            start_date: '2026-07-16',
          }),
        )
      })
    })
  })

  describe('modal a11y and focus management', () => {
    it('renders overlay as dialog with aria-modal and aria-labelledby', () => {
      render(<TaskForm {...defaultProps} />)
      const overlay = screen.getByTestId('task-form-overlay')
      expect(overlay).toHaveAttribute('role', 'dialog')
      expect(overlay).toHaveAttribute('aria-modal', 'true')
      expect(overlay).toHaveAttribute(
        'aria-labelledby',
        'task-form-title-heading',
      )
      const title = screen.getByRole('heading', { level: 2 })
      expect(title).toHaveAttribute('id', 'task-form-title-heading')
    })

    it('closes on Escape', () => {
      render(<TaskForm {...defaultProps} />)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(defaultProps.onCancel).toHaveBeenCalled()
    })

    it('focuses the first focusable element on mount', async () => {
      render(<TaskForm {...defaultProps} />)
      const closeButton = screen.getByTestId('task-form-close')
      await waitFor(() => expect(document.activeElement).toBe(closeButton))
    })

    it('traps focus: Tab from last focusable wraps to first', async () => {
      render(<TaskForm {...defaultProps} />)
      const saveButton = screen.getByTestId('task-form-save')
      saveButton.focus()
      fireEvent.keyDown(document, { key: 'Tab' })
      const closeButton = screen.getByTestId('task-form-close')
      await waitFor(() => expect(document.activeElement).toBe(closeButton))
    })

    it('traps focus: Shift+Tab from first focusable wraps to last', async () => {
      render(<TaskForm {...defaultProps} />)
      const closeButton = screen.getByTestId('task-form-close')
      closeButton.focus()
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
      const saveButton = screen.getByTestId('task-form-save')
      await waitFor(() => expect(document.activeElement).toBe(saveButton))
    })

    it('announces title error with role alert and aria-live', async () => {
      render(<TaskForm {...defaultProps} />)
      fireEvent.click(screen.getByTestId('task-form-save'))
      const error = await screen.findByTestId('task-form-error')
      expect(error).toHaveTextContent('请输入标题')
      expect(error).toHaveAttribute('role', 'alert')
      expect(error).toHaveAttribute('aria-live', 'polite')
    })

    it('announces duration error with role alert and aria-live', async () => {
      render(<TaskForm {...defaultProps} />)
      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-start-date'), {
        target: { value: '2026-12-31' },
      })
      fireEvent.change(screen.getByTestId('task-form-end-date'), {
        target: { value: '2026-01-01' },
      })
      fireEvent.click(screen.getByTestId('task-form-save'))
      const error = await screen.findByTestId('task-form-duration-error')
      expect(error).toHaveTextContent('开始日期不能晚于结束日期')
      expect(error).toHaveAttribute('role', 'alert')
      expect(error).toHaveAttribute('aria-live', 'polite')
    })

    it('announces recurrence error with role alert and aria-live', async () => {
      render(<TaskForm {...defaultProps} />)
      fireEvent.change(screen.getByTestId('task-form-title'), {
        target: { value: 'Test' },
      })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), {
        target: { value: 'daily' },
      })
      fireEvent.click(screen.getByTestId('task-form-save'))
      const error = await screen.findByTestId('task-form-recurrence-error')
      expect(error).toHaveTextContent('重复任务需要截止日期或开始日期')
      expect(error).toHaveAttribute('role', 'alert')
      expect(error).toHaveAttribute('aria-live', 'polite')
    })
  })
})
