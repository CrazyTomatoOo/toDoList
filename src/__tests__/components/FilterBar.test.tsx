/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import FilterBar from '../../renderer/components/FilterBar'

const defaultProps = {
  priorityFilter: '' as const,
  onPriorityChange: vi.fn(),
  statusFilter: 'all' as const,
  onStatusChange: vi.fn(),
  recurrenceFilter: '' as const,
  onRecurrenceChange: vi.fn(),
  durationFilter: 'all' as const,
  onDurationChange: vi.fn(),
  quadrantFilter: '' as const,
  onQuadrantChange: vi.fn()
}

describe('FilterBar', () => {
  it('renders all five filter selects', () => {
    render(<FilterBar {...defaultProps} />)
    expect(screen.getByTestId('filter-priority')).toBeInTheDocument()
    expect(screen.getByTestId('filter-status')).toBeInTheDocument()
    expect(screen.getByTestId('filter-recurrence')).toBeInTheDocument()
    expect(screen.getByTestId('filter-duration')).toBeInTheDocument()
    expect(screen.getByTestId('filter-quadrant')).toBeInTheDocument()
  })

  it('renders recurrence options', () => {
    render(<FilterBar {...defaultProps} />)
    const select = screen.getByTestId('filter-recurrence')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual(['', 'daily', 'weekly', 'monthly', 'yearly'])
  })

  it('renders duration options', () => {
    render(<FilterBar {...defaultProps} />)
    const select = screen.getByTestId('filter-duration')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual(['all', 'hasDateRange', 'noDateRange'])
  })

  it('renders quadrant options', () => {
    render(<FilterBar {...defaultProps} />)
    const select = screen.getByTestId('filter-quadrant')
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value)
    expect(options).toEqual([
      '',
      'q1-urgent-important',
      'q2-not-urgent-important',
      'q3-urgent-not-important',
      'q4-not-urgent-not-important'
    ])
  })

  it('calls onRecurrenceChange when recurrence select changes', async () => {
    const onRecurrenceChange = vi.fn()
    render(<FilterBar {...defaultProps} onRecurrenceChange={onRecurrenceChange} />)
    const user = userEvent.setup()
    await user.selectOptions(screen.getByTestId('filter-recurrence'), 'weekly')
    expect(onRecurrenceChange).toHaveBeenCalledWith('weekly')
  })

  it('calls onDurationChange when duration select changes', async () => {
    const onDurationChange = vi.fn()
    render(<FilterBar {...defaultProps} onDurationChange={onDurationChange} />)
    const user = userEvent.setup()
    await user.selectOptions(screen.getByTestId('filter-duration'), 'hasDateRange')
    expect(onDurationChange).toHaveBeenCalledWith('hasDateRange')
  })

  it('calls onQuadrantChange when quadrant select changes', async () => {
    const onQuadrantChange = vi.fn()
    render(<FilterBar {...defaultProps} onQuadrantChange={onQuadrantChange} />)
    const user = userEvent.setup()
    await user.selectOptions(screen.getByTestId('filter-quadrant'), 'q1-urgent-important')
    expect(onQuadrantChange).toHaveBeenCalledWith('q1-urgent-important')
  })

  it('reflects controlled values for new filters', () => {
    render(
      <FilterBar
        {...defaultProps}
        recurrenceFilter="monthly"
        durationFilter="noDateRange"
        quadrantFilter="q3-urgent-not-important"
      />
    )
    expect(screen.getByTestId('filter-recurrence')).toHaveValue('monthly')
    expect(screen.getByTestId('filter-duration')).toHaveValue('noDateRange')
    expect(screen.getByTestId('filter-quadrant')).toHaveValue('q3-urgent-not-important')
  })

  it('preserves existing priority and status filter behavior', async () => {
    const onPriorityChange = vi.fn()
    const onStatusChange = vi.fn()
    render(
      <FilterBar
        {...defaultProps}
        onPriorityChange={onPriorityChange}
        onStatusChange={onStatusChange}
      />
    )
    const user = userEvent.setup()
    await user.selectOptions(screen.getByTestId('filter-priority'), 'high')
    expect(onPriorityChange).toHaveBeenCalledWith('high')
    await user.selectOptions(screen.getByTestId('filter-status'), 'completed')
    expect(onStatusChange).toHaveBeenCalledWith('completed')
  })
})
