import type { Priority, Recurrence, DurationFilter, Quadrant } from '../../shared/ipc'

interface FilterBarProps {
  priorityFilter: Priority | ''
  onPriorityChange: (priority: Priority | '') => void
  statusFilter: 'all' | 'completed' | 'incomplete'
  onStatusChange: (status: 'all' | 'completed' | 'incomplete') => void
  recurrenceFilter: Recurrence | ''
  onRecurrenceChange: (recurrence: Recurrence | '') => void
  durationFilter: DurationFilter
  onDurationChange: (duration: DurationFilter) => void
  quadrantFilter: Quadrant | ''
  onQuadrantChange: (quadrant: Quadrant | '') => void
}

export default function FilterBar({
  priorityFilter,
  onPriorityChange,
  statusFilter,
  onStatusChange,
  recurrenceFilter,
  onRecurrenceChange,
  durationFilter,
  onDurationChange,
  quadrantFilter,
  onQuadrantChange
}: FilterBarProps) {
  return (
    <div className="filter-bar" data-testid="filter-bar">
      <select
        className="filter-select"
        value={priorityFilter}
        onChange={(e) => onPriorityChange(e.target.value as Priority | '')}
        data-testid="filter-priority"
        aria-label="Filter by priority"
      >
        <option value="">All Priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <select
        className="filter-select"
        value={statusFilter}
        onChange={(e) =>
          onStatusChange(e.target.value as 'all' | 'completed' | 'incomplete')
        }
        data-testid="filter-status"
        aria-label="Filter by status"
      >
        <option value="all">All Status</option>
        <option value="completed">Completed</option>
        <option value="incomplete">Incomplete</option>
      </select>

      <select
        className="filter-select"
        value={recurrenceFilter}
        onChange={(e) => onRecurrenceChange(e.target.value as Recurrence | '')}
        data-testid="filter-recurrence"
        aria-label="Filter by recurrence"
      >
        <option value="">All Recurrences</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>

      <select
        className="filter-select"
        value={durationFilter}
        onChange={(e) => onDurationChange(e.target.value as DurationFilter)}
        data-testid="filter-duration"
        aria-label="Filter by duration"
      >
        <option value="all">All Durations</option>
        <option value="hasDateRange">Has Date Range</option>
        <option value="noDateRange">No Date Range</option>
      </select>

      <select
        className="filter-select"
        value={quadrantFilter}
        onChange={(e) => onQuadrantChange(e.target.value as Quadrant | '')}
        data-testid="filter-quadrant"
        aria-label="Filter by quadrant"
      >
        <option value="">All Quadrants</option>
        <option value="q1-urgent-important">Q1: Urgent &amp; Important</option>
        <option value="q2-not-urgent-important">Q2: Not Urgent &amp; Important</option>
        <option value="q3-urgent-not-important">Q3: Urgent &amp; Not Important</option>
        <option value="q4-not-urgent-not-important">Q4: Not Urgent &amp; Not Important</option>
      </select>
    </div>
  )
}
