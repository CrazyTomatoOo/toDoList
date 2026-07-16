export interface ListRow {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export type Priority = 'high' | 'medium' | 'low'

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
}

export interface UpdateTaskInput {
  title: string
  description: string | null
  priority: Priority
  due_date: string | null
  reminder_at: string | null
  completed: boolean
  sort_order: number
}
