/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import TaskList from '../../renderer/components/TaskList'
import type { TaskRow } from '../../shared/ipc'

const mockTasks: TaskRow[] = [
  {
    id: 1,
    list_id: 1,
    title: 'Buy groceries',
    description: null,
    priority: 'high',
    due_date: '2026-07-20',
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
    updated_at: ''
  },
  {
    id: 2,
    list_id: 1,
    title: 'Read a book',
    description: 'Something relaxing',
    priority: 'low',
    due_date: null,
    reminder_at: null,
    completed: 1,
    sort_order: 1,
    recurrence: null,
    recurrence_end_date: null,
    start_date: null,
    end_date: null,
    is_urgent: 0,
    is_important: 0,
    created_at: '',
    updated_at: ''
  }
]

describe('TaskList', () => {
  const defaultProps = {
    tasks: mockTasks,
    selectedListId: 1,
    loading: false,
    error: null,
    onCreateTask: vi.fn().mockResolvedValue(undefined),
    onUpdateTask: vi.fn().mockResolvedValue(undefined),
    onDeleteTask: vi.fn().mockResolvedValue(undefined),
    onToggleComplete: vi.fn().mockResolvedValue(undefined),
    showAddForm: false,
    onOpenAddForm: vi.fn(),
    onCloseAddForm: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders task items', () => {
    render(<TaskList {...defaultProps} />)
    const items = screen.getAllByTestId('task-item')
    expect(items).toHaveLength(2)
  })

  it('displays task titles', () => {
    render(<TaskList {...defaultProps} />)
    expect(screen.getByText('Buy groceries')).toBeInTheDocument()
    expect(screen.getByText('Read a book')).toBeInTheDocument()
  })

  it('shows strikethrough for completed tasks', () => {
    render(<TaskList {...defaultProps} />)
    const titles = screen.getAllByTestId('task-title')
    expect(titles[1]).toHaveClass('completed')
  })

  it('displays priority badges', () => {
    render(<TaskList {...defaultProps} />)
    expect(screen.getByText('high')).toBeInTheDocument()
    expect(screen.getByText('low')).toBeInTheDocument()
  })

  it('displays due date when set', () => {
    render(<TaskList {...defaultProps} />)
    const dueDate = screen.getByTestId('task-due-date')
    expect(dueDate).not.toBeEmptyDOMElement()
  })

  it('calls onToggleComplete when clicking checkbox', () => {
    render(<TaskList {...defaultProps} />)
    const checkboxes = screen.getAllByTestId('task-checkbox')
    fireEvent.click(checkboxes[0])
    expect(defaultProps.onToggleComplete).toHaveBeenCalledWith(mockTasks[0])
  })

  it('shows empty state when no tasks', () => {
    render(<TaskList {...defaultProps} tasks={[]} />)
    expect(screen.getByTestId('task-list-empty')).toBeInTheDocument()
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<TaskList {...defaultProps} loading={true} />)
    expect(screen.getByTestId('task-list-loading')).toBeInTheDocument()
  })

  it('shows error message', () => {
    render(<TaskList {...defaultProps} error="Failed to load" />)
    expect(screen.getByTestId('task-list-error')).toHaveTextContent('Failed to load')
  })

  it('shows "select a list" when no list selected', () => {
    render(<TaskList {...defaultProps} selectedListId={null} />)
    expect(screen.getByTestId('task-list-empty')).toHaveTextContent('Select a list to view tasks')
  })

  it('calls onOpenAddForm when clicking empty state button', () => {
    render(<TaskList {...defaultProps} tasks={[]} />)
    fireEvent.click(screen.getByText('Add your first task'))
    expect(defaultProps.onOpenAddForm).toHaveBeenCalled()
  })

  it('calls onDeleteTask with confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TaskList {...defaultProps} />)
    const deleteButtons = screen.getAllByTestId('task-delete-button')
    fireEvent.click(deleteButtons[0])
    expect(window.confirm).toHaveBeenCalled()
    expect(defaultProps.onDeleteTask).toHaveBeenCalledWith(1)
  })

  it('shows task form when showAddForm is true', () => {
    render(<TaskList {...defaultProps} showAddForm={true} />)
    expect(screen.getByTestId('task-form')).toBeInTheDocument()
  })
})
