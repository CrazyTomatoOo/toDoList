/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ListSidebar from '../../renderer/components/ListSidebar'
import type { ListWithTaskCount } from '../../shared/ipc'

const mockLists: ListWithTaskCount[] = [
  { id: 1, name: 'Work', totalCount: 3, completedCount: 1, created_at: '', updated_at: '' },
  { id: 2, name: 'Personal', totalCount: 0, completedCount: 0, created_at: '', updated_at: '' }
]

describe('ListSidebar', () => {
  const defaultProps = {
    lists: mockLists,
    selectedListId: 1,
    onSelectList: vi.fn(),
    onCreateList: vi.fn().mockResolvedValue(undefined),
    onDeleteList: vi.fn().mockResolvedValue(undefined),
    loading: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all lists', () => {
    render(<ListSidebar {...defaultProps} />)
    const items = screen.getAllByTestId('sidebar-item')
    expect(items).toHaveLength(2)
  })

  it('displays list names', () => {
    render(<ListSidebar {...defaultProps} />)
    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Personal')).toBeInTheDocument()
  })

  it('displays task counts', () => {
    render(<ListSidebar {...defaultProps} />)
    const counts = screen.getAllByTestId('sidebar-item-count')
    expect(counts[0]).toHaveTextContent('3')
    expect(counts[1]).toHaveTextContent('0')
  })

  it('highlights selected list', () => {
    render(<ListSidebar {...defaultProps} />)
    const items = screen.getAllByTestId('sidebar-item')
    expect(items[0]).toHaveClass('active')
    expect(items[1]).not.toHaveClass('active')
  })

  it('calls onSelectList when clicking a list', () => {
    render(<ListSidebar {...defaultProps} />)
    const items = screen.getAllByTestId('sidebar-item')
    // Click the inner button (sidebar-item-button) within the outer div
    const innerButton = items[1].querySelector('button')!
    fireEvent.click(innerButton)
    expect(defaultProps.onSelectList).toHaveBeenCalledWith(2)
  })

  it('shows empty state when no lists', () => {
    render(<ListSidebar {...defaultProps} lists={[]} />)
    expect(screen.getByTestId('sidebar-empty')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<ListSidebar {...defaultProps} lists={[]} loading={true} />)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows add list form when clicking add button', () => {
    render(<ListSidebar {...defaultProps} />)
    fireEvent.click(screen.getByTestId('add-list-button'))
    expect(screen.getByTestId('list-form')).toBeInTheDocument()
  })

  it('calls onDeleteList with confirmation when deleting', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ListSidebar {...defaultProps} />)
    const deleteButtons = screen.getAllByTestId('sidebar-item-delete')
    fireEvent.click(deleteButtons[0])
    expect(window.confirm).toHaveBeenCalledWith('Delete "Work" and all its tasks?')
    expect(defaultProps.onDeleteList).toHaveBeenCalledWith(1)
  })

  it('does not delete when confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ListSidebar {...defaultProps} />)
    const deleteButtons = screen.getAllByTestId('sidebar-item-delete')
    fireEvent.click(deleteButtons[0])
    expect(defaultProps.onDeleteList).not.toHaveBeenCalled()
  })
})
