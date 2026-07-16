import type { Priority } from '../../shared/ipc'

interface FilterBarProps {
  priorityFilter: Priority | ''
  onPriorityChange: (priority: Priority | '') => void
  statusFilter: 'all' | 'completed' | 'incomplete'
  onStatusChange: (status: 'all' | 'completed' | 'incomplete') => void
}

export default function FilterBar({
  priorityFilter,
  onPriorityChange,
  statusFilter,
  onStatusChange
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
    </div>
  )
}
