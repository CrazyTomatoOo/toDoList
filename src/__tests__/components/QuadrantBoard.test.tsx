/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import QuadrantBoard from '../../renderer/components/QuadrantBoard'
import type { TaskRow } from '../../shared/ipc'

function makeTask(overrides: Partial<TaskRow> & Pick<TaskRow, 'id' | 'title'>): TaskRow {
  return {
    list_id: 1,
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
  }
}

const q1Task = makeTask({ id: 1, title: 'Q1 Crisis', is_urgent: 1, is_important: 1 })
const q2Task = makeTask({ id: 2, title: 'Q2 Planning', is_urgent: 0, is_important: 1 })
const q3Task = makeTask({ id: 3, title: 'Q3 Interruption', is_urgent: 1, is_important: 0 })
const q4Task = makeTask({ id: 4, title: 'Q4 Distraction', is_urgent: 0, is_important: 0 })

describe('QuadrantBoard', () => {
  const defaultProps = {
    tasks: [q1Task, q2Task, q3Task, q4Task],
    selectedListId: 1,
    onUpdateTask: vi.fn().mockResolvedValue(undefined),
    onDeleteTask: vi.fn().mockResolvedValue(undefined),
    onToggleComplete: vi.fn().mockResolvedValue(undefined)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all four quadrants', () => {
    render(<QuadrantBoard {...defaultProps} />)
    expect(screen.getByTestId('quadrant-q1')).toBeInTheDocument()
    expect(screen.getByTestId('quadrant-q2')).toBeInTheDocument()
    expect(screen.getByTestId('quadrant-q3')).toBeInTheDocument()
    expect(screen.getByTestId('quadrant-q4')).toBeInTheDocument()
  })

  it('places tasks in the correct quadrants', () => {
    render(<QuadrantBoard {...defaultProps} />)

    const q1Tasks = screen.getByTestId('quadrant-q1-tasks')
    const q2Tasks = screen.getByTestId('quadrant-q2-tasks')
    const q3Tasks = screen.getByTestId('quadrant-q3-tasks')
    const q4Tasks = screen.getByTestId('quadrant-q4-tasks')

    expect(q1Tasks).toHaveTextContent('Q1 Crisis')
    expect(q2Tasks).toHaveTextContent('Q2 Planning')
    expect(q3Tasks).toHaveTextContent('Q3 Interruption')
    expect(q4Tasks).toHaveTextContent('Q4 Distraction')
  })

  it('shows quadrant labels and subtitles', () => {
    render(<QuadrantBoard {...defaultProps} />)
    expect(screen.getByText('Q1: Do First')).toBeInTheDocument()
    expect(screen.getByText('Urgent & Important')).toBeInTheDocument()
    expect(screen.getByText('Q2: Schedule')).toBeInTheDocument()
    expect(screen.getByText('Not Urgent & Important')).toBeInTheDocument()
    expect(screen.getByText('Q3: Delegate')).toBeInTheDocument()
    expect(screen.getByText('Urgent & Not Important')).toBeInTheDocument()
    expect(screen.getByText('Q4: Eliminate')).toBeInTheDocument()
    expect(screen.getByText('Not Urgent & Not Important')).toBeInTheDocument()
  })

  it('shows task counts per quadrant', () => {
    render(<QuadrantBoard {...defaultProps} />)
    const counts = screen.getAllByText('1')
    expect(counts.length).toBeGreaterThanOrEqual(4)
  })

  it('shows empty state messages when quadrants have no tasks', () => {
    render(<QuadrantBoard {...defaultProps} tasks={[]} />)
    expect(screen.getByTestId('quadrant-q1-empty')).toHaveTextContent(
      'No urgent & important tasks'
    )
    expect(screen.getByTestId('quadrant-q2-empty')).toHaveTextContent(
      'No important tasks to schedule'
    )
    expect(screen.getByTestId('quadrant-q3-empty')).toHaveTextContent('No tasks to delegate')
    expect(screen.getByTestId('quadrant-q4-empty')).toHaveTextContent('No tasks to eliminate')
  })

  it('shows "select a list" when no list is selected', () => {
    render(<QuadrantBoard {...defaultProps} selectedListId={null} />)
    expect(screen.getByTestId('quadrant-board-empty')).toHaveTextContent(
      'Select a list to view the quadrant board'
    )
  })

  it('calls onToggleComplete when clicking a task checkbox', () => {
    render(<QuadrantBoard {...defaultProps} />)
    const checkboxes = screen.getAllByTestId('task-checkbox')
    fireEvent.click(checkboxes[0])
    expect(defaultProps.onToggleComplete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 })
    )
  })

  it('opens edit form when clicking edit button', () => {
    render(<QuadrantBoard {...defaultProps} />)
    const editButtons = screen.getAllByTestId('task-edit-button')
    fireEvent.click(editButtons[0])
    expect(screen.getByTestId('task-form')).toBeInTheDocument()
  })

  it('groups multiple tasks in the same quadrant', () => {
    const tasks = [
      q1Task,
      makeTask({ id: 5, title: 'Q1 Another', is_urgent: 1, is_important: 1 }),
      q2Task
    ]
    render(<QuadrantBoard {...defaultProps} tasks={tasks} />)

    const q1Tasks = screen.getByTestId('quadrant-q1-tasks')
    expect(q1Tasks).toHaveTextContent('Q1 Crisis')
    expect(q1Tasks).toHaveTextContent('Q1 Another')

    const q2Tasks = screen.getByTestId('quadrant-q2-tasks')
    expect(q2Tasks).toHaveTextContent('Q2 Planning')
  })

  it('calls onDeleteTask with confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<QuadrantBoard {...defaultProps} />)
    const deleteButtons = screen.getAllByTestId('task-delete-button')
    fireEvent.click(deleteButtons[0])
    expect(window.confirm).toHaveBeenCalled()
    expect(defaultProps.onDeleteTask).toHaveBeenCalledWith(1)
  })
  it('groups all four quadrant combinations in a single render', () => {
    const tasks = [
      makeTask({ id: 10, title: 'Q1', is_urgent: 1, is_important: 1 }),
      makeTask({ id: 11, title: 'Q2', is_urgent: 0, is_important: 1 }),
      makeTask({ id: 12, title: 'Q3', is_urgent: 1, is_important: 0 }),
      makeTask({ id: 13, title: 'Q4', is_urgent: 0, is_important: 0 })
    ]
    render(<QuadrantBoard {...defaultProps} tasks={tasks} />)

    expect(screen.getByTestId('quadrant-q1-tasks')).toHaveTextContent('Q1')
    expect(screen.getByTestId('quadrant-q2-tasks')).toHaveTextContent('Q2')
    expect(screen.getByTestId('quadrant-q3-tasks')).toHaveTextContent('Q3')
    expect(screen.getByTestId('quadrant-q4-tasks')).toHaveTextContent('Q4')
  })

})
