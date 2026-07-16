/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import TaskItem, { getQuadrantLabel } from '../../renderer/components/TaskItem'
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
  task: createMockTask(),
  onToggleComplete: vi.fn().mockResolvedValue(undefined),
  onEdit: vi.fn(),
  onDelete: vi.fn().mockResolvedValue(undefined)
}

describe('TaskItem', () => {
  describe('getQuadrantLabel helper', () => {
    it('returns Q1 for urgent and important', () => {
      expect(getQuadrantLabel(1, 1)).toBe('Q1')
    })

    it('returns Q2 for not urgent and important', () => {
      expect(getQuadrantLabel(0, 1)).toBe('Q2')
    })

    it('returns Q3 for urgent and not important', () => {
      expect(getQuadrantLabel(1, 0)).toBe('Q3')
    })

    it('returns Q4 for not urgent and not important', () => {
      expect(getQuadrantLabel(0, 0)).toBe('Q4')
    })
  })

  describe('recurrence badge', () => {
    it('displays recurrence badge when recurrence is set', () => {
      const task = createMockTask({ recurrence: 'daily' })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-recurrence')).toHaveTextContent('Daily')
    })

    it('displays weekly recurrence', () => {
      const task = createMockTask({ recurrence: 'weekly' })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-recurrence')).toHaveTextContent('Weekly')
    })

    it('displays monthly recurrence', () => {
      const task = createMockTask({ recurrence: 'monthly' })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-recurrence')).toHaveTextContent('Monthly')
    })

    it('displays yearly recurrence', () => {
      const task = createMockTask({ recurrence: 'yearly' })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-recurrence')).toHaveTextContent('Yearly')
    })

    it('does not display recurrence badge when recurrence is null', () => {
      const task = createMockTask({ recurrence: null })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.queryByTestId('task-recurrence')).not.toBeInTheDocument()
    })
  })

  describe('duration badge', () => {
    it('displays date range when both start and end dates are set', () => {
      const task = createMockTask({
        start_date: '2024-01-01',
        end_date: '2024-01-07'
      })
      render(<TaskItem {...defaultProps} task={task} />)
      const duration = screen.getByTestId('task-duration')
      expect(duration).toBeInTheDocument()
      expect(duration.textContent).toContain('→')
    })

    it('displays duration badge when only start_date is set', () => {
      const task = createMockTask({ start_date: '2024-01-01', end_date: null })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-duration')).toBeInTheDocument()
    })

    it('displays duration badge when only end_date is set', () => {
      const task = createMockTask({ start_date: null, end_date: '2024-01-07' })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-duration')).toBeInTheDocument()
    })

    it('does not display duration badge when neither date is set', () => {
      const task = createMockTask({ start_date: null, end_date: null })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.queryByTestId('task-duration')).not.toBeInTheDocument()
    })
  })

  describe('quadrant badge', () => {
    it('displays Q1 for urgent and important task', () => {
      const task = createMockTask({ is_urgent: 1, is_important: 1 })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-quadrant')).toHaveTextContent('Q1')
    })

    it('displays Q2 for not urgent and important task', () => {
      const task = createMockTask({ is_urgent: 0, is_important: 1 })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-quadrant')).toHaveTextContent('Q2')
    })

    it('displays Q3 for urgent and not important task', () => {
      const task = createMockTask({ is_urgent: 1, is_important: 0 })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-quadrant')).toHaveTextContent('Q3')
    })

    it('displays Q4 for not urgent and not important task', () => {
      const task = createMockTask({ is_urgent: 0, is_important: 0 })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-quadrant')).toHaveTextContent('Q4')
    })

    it('always displays quadrant badge', () => {
      const task = createMockTask()
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-quadrant')).toBeInTheDocument()
    })
  })

  describe('existing functionality', () => {
    it('still displays priority badge', () => {
      const task = createMockTask({ priority: 'high' })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-priority')).toHaveTextContent('high')
    })

    it('still displays due date when set', () => {
      const task = createMockTask({ due_date: '2024-01-15' })
      render(<TaskItem {...defaultProps} task={task} />)
      expect(screen.getByTestId('task-due-date')).toBeInTheDocument()
    })

    it('displays all badges together', () => {
      const task = createMockTask({
        priority: 'high',
        due_date: '2024-01-15',
        recurrence: 'weekly',
        start_date: '2024-01-01',
        end_date: '2024-01-07',
        is_urgent: 1,
        is_important: 1
      })
      render(<TaskItem {...defaultProps} task={task} />)
      
      expect(screen.getByTestId('task-priority')).toHaveTextContent('high')
      expect(screen.getByTestId('task-due-date')).toBeInTheDocument()
      expect(screen.getByTestId('task-recurrence')).toHaveTextContent('Weekly')
      expect(screen.getByTestId('task-duration')).toBeInTheDocument()
      expect(screen.getByTestId('task-quadrant')).toHaveTextContent('Q1')
    })
  })

  describe('fallback behavior', () => {
    it('handles task with all null/zero values gracefully', () => {
      const task = createMockTask({
        recurrence: null,
        start_date: null,
        end_date: null,
        is_urgent: 0,
        is_important: 0
      })
      render(<TaskItem {...defaultProps} task={task} />)
      
      // Should still render quadrant badge (Q4)
      expect(screen.getByTestId('task-quadrant')).toHaveTextContent('Q4')
      // Should not render recurrence or duration badges
      expect(screen.queryByTestId('task-recurrence')).not.toBeInTheDocument()
      expect(screen.queryByTestId('task-duration')).not.toBeInTheDocument()
    })
  })
})
