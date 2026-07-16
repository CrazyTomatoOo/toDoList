/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../../renderer/App'
import type { TaskRow } from '../../shared/ipc'

// Mock hooks
vi.mock('../../renderer/hooks/useLists', () => ({
  useLists: () => ({
    lists: [{ id: 1, name: 'Test List', task_count: 2 }],
    loading: false,
    createList: vi.fn(),
    updateList: vi.fn(),
    deleteList: vi.fn(),
    refresh: vi.fn()
  })
}))

vi.mock('../../renderer/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [
      {
        id: 1,
        list_id: 1,
        title: 'Task 1',
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
        is_urgent: 1,
        is_important: 1,
        created_at: '',
        updated_at: ''
      }
    ] as TaskRow[],
    loading: false,
    error: null,
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    toggleComplete: vi.fn(),
    refresh: vi.fn()
  })
}))

vi.mock('../../renderer/hooks/useSelectedList', () => ({
  useSelectedList: () => ({
    selectedListId: 1,
    selectList: vi.fn(),
    clearSelection: vi.fn()
  })
}))

vi.mock('../../renderer/hooks/useSearchAndFilter', () => ({
  useSearchAndFilter: () => ({
    query: '',
    setQuery: vi.fn(),
    priorityFilter: '',
    setPriorityFilter: vi.fn(),
    statusFilter: 'all',
    setStatusFilter: vi.fn(),
    recurrenceFilter: '',
    setRecurrenceFilter: vi.fn(),
    durationFilter: 'all',
    setDurationFilter: vi.fn(),
    quadrantFilter: '',
    setQuadrantFilter: vi.fn(),
    filteredTasks: [
      {
        id: 1,
        list_id: 1,
        title: 'Task 1',
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
        is_urgent: 1,
        is_important: 1,
        created_at: '',
        updated_at: ''
      }
    ] as TaskRow[],
    isFiltering: false,
    loading: false
  })
}))

vi.mock('../../renderer/services/theme', () => ({
  useTheme: () => ({
    mode: 'light',
    toggle: vi.fn()
  })
}))

// Mock electronAPI
beforeEach(() => {
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: {
      lists: {
        getWithTaskCount: vi.fn(async () => []),
        getAll: vi.fn(async () => [])
      },
      tasks: {
        getByListId: vi.fn(async () => [])
      },
      importExport: {
        importFile: vi.fn(),
        exportJson: vi.fn(),
        exportCsv: vi.fn()
      },
      reminders: {
        onReminderClicked: vi.fn(() => vi.fn())
      }
    }
  })
})

describe('App view toggle', () => {
  it('renders view toggle buttons when a list is selected', () => {
    render(<App />)
    expect(screen.getByTestId('view-toggle-list')).toBeInTheDocument()
    expect(screen.getByTestId('view-toggle-board')).toBeInTheDocument()
  })

  it('starts in list view by default', () => {
    render(<App />)
    expect(screen.getByTestId('view-toggle-list')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('view-toggle-board')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('search-filter-bar')).toBeInTheDocument()
  })

  it('switches to board view when Board button is clicked', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('view-toggle-board'))
    
    expect(screen.getByTestId('view-toggle-board')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('view-toggle-list')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('search-filter-bar')).not.toBeInTheDocument()
    expect(screen.getByTestId('quadrant-board')).toBeInTheDocument()
  })

  it('switches back to list view when List button is clicked', () => {
    render(<App />)
    
    // Switch to board
    fireEvent.click(screen.getByTestId('view-toggle-board'))
    expect(screen.getByTestId('quadrant-board')).toBeInTheDocument()
    
    // Switch back to list
    fireEvent.click(screen.getByTestId('view-toggle-list'))
    expect(screen.getByTestId('search-filter-bar')).toBeInTheDocument()
    expect(screen.queryByTestId('quadrant-board')).not.toBeInTheDocument()
  })

  it('preserves selected list when switching views', () => {
    render(<App />)
    
    // Verify list is selected in list view
    expect(screen.getAllByText('Test List').length).toBeGreaterThanOrEqual(1)
    
    // Switch to board view
    fireEvent.click(screen.getByTestId('view-toggle-board'))
    
    // List name should still be visible in header
    expect(screen.getAllByText('Test List').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('quadrant-board')).toBeInTheDocument()
  })
  it('shows selected list name in board view after toggling', () => {
    render(<App />)

    fireEvent.click(screen.getByTestId('view-toggle-board'))

    expect(screen.getByRole('heading', { level: 1, name: 'Test List' })).toBeInTheDocument()
    expect(screen.getByTestId('quadrant-board')).toBeInTheDocument()
  })

})


describe('App redesigned UI classes', () => {
  it('renders app shell with app-layout class', () => {
    render(<App />)
    expect(screen.getByTestId('app-shell')).toHaveClass('app-layout')
  })

  it('renders main header and actions with redesigned classes', () => {
    render(<App />)
    const shell = screen.getByTestId('app-shell')
    expect(shell.querySelector('.main-area')).toBeInTheDocument()
    expect(shell.querySelector('.main-header')).toBeInTheDocument()
    expect(shell.querySelector('.main-header-actions')).toBeInTheDocument()
  })

  it('renders theme toggle with ghost icon button classes and aria-label', () => {
    render(<App />)
    const toggle = screen.getByTestId('theme-toggle')
    expect(toggle).toHaveClass('btn', 'btn-ghost', 'btn-icon', 'theme-toggle')
    expect(toggle).toHaveAttribute('aria-label', 'Current theme: light. Click to change.')
    expect(toggle.querySelector('svg')).toBeInTheDocument()
  })

  it('renders Add Task button with primary class and Lucide Plus icon', () => {
    render(<App />)
    const addButton = screen.getByTestId('add-task-button')
    expect(addButton).toHaveClass('btn', 'btn-primary')
    expect(addButton).toHaveTextContent('Add Task')
    expect(addButton.querySelector('svg')).toBeInTheDocument()
  })

  it('renders search-filter-bar with redesigned class', () => {
    render(<App />)
    const bar = screen.getByTestId('search-filter-bar')
    expect(bar).toHaveClass('search-filter-bar')
  })
})

