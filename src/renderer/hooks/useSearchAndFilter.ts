import { useState, useEffect, useRef } from 'react'
import type {
  TaskRow,
  Priority,
  Recurrence,
  DurationFilter,
  Quadrant,
  TaskSearchFilters
} from '../../shared/ipc'

interface UseSearchAndFilterReturn {
  query: string
  setQuery: (q: string) => void
  priorityFilter: Priority | ''
  setPriorityFilter: (p: Priority | '') => void
  statusFilter: 'all' | 'completed' | 'incomplete'
  setStatusFilter: (s: 'all' | 'completed' | 'incomplete') => void
  recurrenceFilter: Recurrence | ''
  setRecurrenceFilter: (r: Recurrence | '') => void
  durationFilter: DurationFilter
  setDurationFilter: (d: DurationFilter) => void
  quadrantFilter: Quadrant | ''
  setQuadrantFilter: (q: Quadrant | '') => void
  filteredTasks: TaskRow[]
  isFiltering: boolean
  loading: boolean
}

export function useSearchAndFilter(
  tasks: TaskRow[],
  selectedListId: number | null
): UseSearchAndFilterReturn {
  const [query, setQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'incomplete'>('all')
  const [recurrenceFilter, setRecurrenceFilter] = useState<Recurrence | ''>('')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all')
  const [quadrantFilter, setQuadrantFilter] = useState<Quadrant | ''>('')
  const [filteredTasks, setFilteredTasks] = useState<TaskRow[]>(tasks)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isFiltering =
    query.trim().length > 0 ||
    priorityFilter !== '' ||
    statusFilter !== 'all' ||
    recurrenceFilter !== '' ||
    durationFilter !== 'all' ||
    quadrantFilter !== ''

  // Reset filters when list changes
  useEffect(() => {
    setQuery('')
    setPriorityFilter('')
    setStatusFilter('all')
    setRecurrenceFilter('')
    setDurationFilter('all')
    setQuadrantFilter('')
  }, [selectedListId])

  // Sync filtered tasks when not filtering
  useEffect(() => {
    if (!isFiltering) {
      setFilteredTasks(tasks)
      setLoading(false)
    }
  }, [tasks, isFiltering])

  // Debounced search when query/filters change
  useEffect(() => {
    if (!isFiltering || selectedListId === null) {
      return
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const filters: TaskSearchFilters = { listId: selectedListId }
        if (priorityFilter) {
          filters.priority = priorityFilter
        }
        if (statusFilter === 'completed') {
          filters.completed = true
        } else if (statusFilter === 'incomplete') {
          filters.completed = false
        }
        if (recurrenceFilter) {
          filters.recurrence = recurrenceFilter
        }
        if (durationFilter !== 'all') {
          filters.durationFilter = durationFilter
        }
        if (quadrantFilter) {
          filters.quadrant = quadrantFilter
        }

        const results = await window.electronAPI.tasks.search(query.trim(), filters)
        setFilteredTasks(results)
      } catch {
        // On error, fall back to unfiltered tasks
        setFilteredTasks(tasks)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [
    query,
    priorityFilter,
    statusFilter,
    recurrenceFilter,
    durationFilter,
    quadrantFilter,
    selectedListId,
    isFiltering,
    tasks
  ])

  return {
    query,
    setQuery,
    priorityFilter,
    setPriorityFilter,
    statusFilter,
    setStatusFilter,
    recurrenceFilter,
    setRecurrenceFilter,
    durationFilter,
    setDurationFilter,
    quadrantFilter,
    setQuadrantFilter,
    filteredTasks,
    isFiltering,
    loading
  }
}
