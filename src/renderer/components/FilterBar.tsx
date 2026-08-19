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
        aria-label="按优先级筛选"
      >
        <option value="">全部优先级</option>
        <option value="high">高</option>
        <option value="medium">中</option>
        <option value="low">低</option>
      </select>

      <select
        className="filter-select"
        value={statusFilter}
        onChange={(e) =>
          onStatusChange(e.target.value as 'all' | 'completed' | 'incomplete')
        }
        data-testid="filter-status"
        aria-label="按状态筛选"
      >
        <option value="all">全部状态</option>
        <option value="completed">已完成</option>
        <option value="incomplete">未完成</option>
      </select>

      <select
        className="filter-select"
        value={recurrenceFilter}
        onChange={(e) => onRecurrenceChange(e.target.value as Recurrence | '')}
        data-testid="filter-recurrence"
        aria-label="按重复筛选"
      >
        <option value="">全部重复</option>
        <option value="daily">每天</option>
        <option value="weekly">每周</option>
        <option value="monthly">每月</option>
        <option value="yearly">每年</option>
      </select>

      <select
        className="filter-select"
        value={durationFilter}
        onChange={(e) => onDurationChange(e.target.value as DurationFilter)}
        data-testid="filter-duration"
        aria-label="按时长筛选"
      >
        <option value="all">全部时长</option>
        <option value="hasDateRange">有日期范围</option>
        <option value="noDateRange">无日期范围</option>
      </select>

      <select
        className="filter-select"
        value={quadrantFilter}
        onChange={(e) => onQuadrantChange(e.target.value as Quadrant | '')}
        data-testid="filter-quadrant"
        aria-label="按象限筛选"
      >
        <option value="">全部象限</option>
        <option value="q1-urgent-important">Q1：重要且紧急</option>
        <option value="q2-not-urgent-important">Q2：重要不紧急</option>
        <option value="q3-urgent-not-important">Q3：紧急不重要</option>
        <option value="q4-not-urgent-not-important">Q4：不重要不紧急</option>
      </select>
    </div>
  )
}
