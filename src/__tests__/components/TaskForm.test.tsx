/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
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
  ...overrides
})

const defaultProps = {
  listId: 1,
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn()
}

describe('TaskForm', () => {
  describe('new fields rendering', () => {
    it('renders recurrence select with all options', () => {
      render(<TaskForm {...defaultProps} />)
      const select = screen.getByTestId('task-form-recurrence')
      expect(select).toBeInTheDocument()
      expect(screen.getByText('None')).toBeInTheDocument()
      expect(screen.getByText('Daily')).toBeInTheDocument()
      expect(screen.getByText('Weekly')).toBeInTheDocument()
      expect(screen.getByText('Monthly')).toBeInTheDocument()
      expect(screen.getByText('Yearly')).toBeInTheDocument()
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
        expect(screen.getByTestId('task-form-recurrence-end-date')).toBeInTheDocument()
      })
    })

    it('pre-fills fields from existing task', () => {
      const task = createMockTask({
        recurrence: 'weekly',
        recurrence_end_date: '2026-12-31',
        start_date: '2026-01-01',
        end_date: '2026-01-31',
        is_urgent: 1,
        is_important: 1
      })
      render(<TaskForm {...defaultProps} task={task} />)
      
      const recurrenceSelect = screen.getByTestId('task-form-recurrence') as HTMLSelectElement
      expect(recurrenceSelect.value).toBe('weekly')
      
      const recurrenceEndDate = screen.getByTestId('task-form-recurrence-end-date') as HTMLInputElement
      expect(recurrenceEndDate.value).toBe('2026-12-31')
      
      const startDate = screen.getByTestId('task-form-start-date') as HTMLInputElement
      expect(startDate.value).toBe('2026-01-01')
      
      const endDate = screen.getByTestId('task-form-end-date') as HTMLInputElement
      expect(endDate.value).toBe('2026-01-31')
      
      const urgent = screen.getByTestId('task-form-urgent') as HTMLInputElement
      expect(urgent.checked).toBe(true)
      
      const important = screen.getByTestId('task-form-important') as HTMLInputElement
      expect(important.checked).toBe(true)
    })
  })

  describe('validation', () => {
    it('blocks submission when start_date > end_date', async () => {
      render(<TaskForm {...defaultProps} />)
      
      fireEvent.change(screen.getByTestId('task-form-title'), { target: { value: 'Test' } })
      fireEvent.change(screen.getByTestId('task-form-start-date'), { target: { value: '2026-12-31' } })
      fireEvent.change(screen.getByTestId('task-form-end-date'), { target: { value: '2026-01-01' } })
      
      fireEvent.click(screen.getByTestId('task-form-save'))
      
      await waitFor(() => {
        expect(screen.getByTestId('task-form-duration-error')).toHaveTextContent(
          'Start date must be before or equal to end date'
        )
      })
      
      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('blocks submission when recurrence is set without due_date or start_date', async () => {
      render(<TaskForm {...defaultProps} />)
      
      fireEvent.change(screen.getByTestId('task-form-title'), { target: { value: 'Test' } })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), { target: { value: 'daily' } })
      
      fireEvent.click(screen.getByTestId('task-form-save'))
      
      await waitFor(() => {
        expect(screen.getByTestId('task-form-recurrence-error')).toHaveTextContent(
          'Recurring tasks require a due date or start date'
        )
      })
      
      expect(defaultProps.onSubmit).not.toHaveBeenCalled()
    })

    it('allows submission when recurrence is set with due_date', async () => {
      render(<TaskForm {...defaultProps} />)
      
      fireEvent.change(screen.getByTestId('task-form-title'), { target: { value: 'Test' } })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), { target: { value: 'daily' } })
      fireEvent.change(screen.getByTestId('task-form-due-date'), { target: { value: '2026-07-16' } })
      
      fireEvent.click(screen.getByTestId('task-form-save'))
      
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test',
            recurrence: 'daily',
            due_date: '2026-07-16'
          })
        )
      })
    })

    it('allows submission when recurrence is set with start_date', async () => {
      render(<TaskForm {...defaultProps} />)
      
      fireEvent.change(screen.getByTestId('task-form-title'), { target: { value: 'Test' } })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), { target: { value: 'weekly' } })
      fireEvent.change(screen.getByTestId('task-form-start-date'), { target: { value: '2026-07-16' } })
      
      fireEvent.click(screen.getByTestId('task-form-save'))
      
      await waitFor(() => {
        expect(defaultProps.onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test',
            recurrence: 'weekly',
            start_date: '2026-07-16'
          })
        )
      })
    })

    it('submits all new fields correctly', async () => {
      render(<TaskForm {...defaultProps} />)
      
      fireEvent.change(screen.getByTestId('task-form-title'), { target: { value: 'Test Task' } })
      fireEvent.change(screen.getByTestId('task-form-recurrence'), { target: { value: 'monthly' } })
      fireEvent.change(screen.getByTestId('task-form-recurrence-end-date'), { target: { value: '2026-12-31' } })
      fireEvent.change(screen.getByTestId('task-form-start-date'), { target: { value: '2026-01-01' } })
      fireEvent.change(screen.getByTestId('task-form-end-date'), { target: { value: '2026-01-31' } })
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
          recurrence: 'monthly',
          recurrence_end_date: '2026-12-31',
          start_date: '2026-01-01',
          end_date: '2026-01-31',
          is_urgent: true,
          is_important: true
        })
      })
    })
  })
})
