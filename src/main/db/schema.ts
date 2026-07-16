export interface ListRow {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export type Priority = 'high' | 'medium' | 'low'
export type Recurrence = 'daily' | 'weekly' | 'monthly' | 'yearly'
export type Quadrant =
  | 'q1-urgent-important'
  | 'q2-not-urgent-important'
  | 'q3-urgent-not-important'
  | 'q4-not-urgent-not-important'
export type DurationFilter = 'all' | 'hasDateRange' | 'noDateRange'
export interface TaskRow {
  id: number
  list_id: number
  title: string
  description: string | null
  priority: Priority
  due_date: string | null
  reminder_at: string | null
  completed: 0 | 1
  sort_order: number
  recurrence: Recurrence | null
  recurrence_end_date: string | null
  start_date: string | null
  end_date: string | null
  is_urgent: 0 | 1
  is_important: 0 | 1
  created_at: string
  updated_at: string
}

export interface CreateTaskInput {
  list_id: number
  title: string
  description?: string | null
  priority?: Priority
  due_date?: string | null
  reminder_at?: string | null
  recurrence?: Recurrence | null
  recurrence_end_date?: string | null
  start_date?: string | null
  end_date?: string | null
  is_urgent?: boolean
  is_important?: boolean
}

export interface UpdateTaskInput {
  title: string
  description: string | null
  priority: Priority
  due_date: string | null
  reminder_at: string | null
  completed: boolean
  sort_order: number
  recurrence: Recurrence | null
  recurrence_end_date: string | null
  start_date: string | null
  end_date: string | null
  is_urgent: boolean
  is_important: boolean
}
