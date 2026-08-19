import { useState, useMemo } from 'react'
import type { TaskRow, UpdateTaskInput } from '../../shared/ipc'
import TaskItem from './TaskItem'
import TaskForm, { type TaskFormData } from './TaskForm'

interface QuadrantBoardProps {
  tasks: TaskRow[]
  selectedListId: number | null
  onUpdateTask: (id: number, input: Partial<UpdateTaskInput>) => Promise<void>
  onDeleteTask: (id: number) => Promise<void>
  onToggleComplete: (task: TaskRow) => Promise<void>
}

type QuadrantKey = 'q1' | 'q2' | 'q3' | 'q4'

interface QuadrantConfig {
  key: QuadrantKey
  label: string
  subtitle: string
  isUrgent: 0 | 1
  isImportant: 0 | 1
  emptyMessage: string
}

const QUADRANTS: QuadrantConfig[] = [
  {
    key: 'q1',
    label: 'Q1：重要且紧急',
    subtitle: '立即执行',
    isUrgent: 1,
    isImportant: 1,
    emptyMessage: '暂无重要且紧急的任务'
  },
  {
    key: 'q2',
    label: 'Q2：重要不紧急',
    subtitle: '制定计划',
    isUrgent: 0,
    isImportant: 1,
    emptyMessage: '暂无需要计划的重要任务'
  },
  {
    key: 'q3',
    label: 'Q3：紧急不重要',
    subtitle: '委托他人',
    isUrgent: 1,
    isImportant: 0,
    emptyMessage: '暂无需要委托的任务'
  },
  {
    key: 'q4',
    label: 'Q4：不重要不紧急',
    subtitle: '尽量不做',
    isUrgent: 0,
    isImportant: 0,
    emptyMessage: '暂无需要减少的任务'
  }
]

function groupTasksByQuadrant(tasks: TaskRow[]): Record<QuadrantKey, TaskRow[]> {
  const groups: Record<QuadrantKey, TaskRow[]> = { q1: [], q2: [], q3: [], q4: [] }
  for (const task of tasks) {
    if (task.is_urgent === 1 && task.is_important === 1) {
      groups.q1.push(task)
    } else if (task.is_urgent === 0 && task.is_important === 1) {
      groups.q2.push(task)
    } else if (task.is_urgent === 1 && task.is_important === 0) {
      groups.q3.push(task)
    } else {
      groups.q4.push(task)
    }
  }
  return groups
}

export default function QuadrantBoard({
  tasks,
  selectedListId,
  onUpdateTask,
  onDeleteTask,
  onToggleComplete
}: QuadrantBoardProps) {
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null)
  const groupedTasks = useMemo(() => groupTasksByQuadrant(tasks), [tasks])

  const handleEdit = async (data: TaskFormData) => {
    if (!editingTask) return
    await onUpdateTask(editingTask.id, {
      title: data.title,
      description: data.description,
      priority: data.priority,
      due_date: data.due_date,
      reminder_at: data.reminder_at,
      recurrence: data.recurrence,
      recurrence_end_date: data.recurrence_end_date,
      start_date: data.start_date,
      end_date: data.end_date,
      is_urgent: data.is_urgent,
      is_important: data.is_important
    })
    setEditingTask(null)
  }

  if (selectedListId === null) {
    return (
      <div className="main-empty" data-testid="quadrant-board-empty">
        请选择列表查看看板
      </div>
    )
  }

  return (
    <div className="quadrant-board" data-testid="quadrant-board">
      <div className="quadrant-grid">
        {QUADRANTS.map((quadrant) => {
          const quadrantTasks = groupedTasks[quadrant.key]
          return (
            <div
              key={quadrant.key}
              className={`quadrant quadrant-${quadrant.key}`}
              data-testid={`quadrant-${quadrant.key}`}
            >
              <div className="quadrant-header">
                <div className="quadrant-label">{quadrant.label}</div>
                <div className="quadrant-subtitle">{quadrant.subtitle}</div>
                <div className="quadrant-count">{quadrantTasks.length}</div>
              </div>
              <div className="quadrant-body">
                {quadrantTasks.length === 0 ? (
                  <div className="quadrant-empty" data-testid={`quadrant-${quadrant.key}-empty`}>
                    {quadrant.emptyMessage}
                  </div>
                ) : (
                  <ul className="task-list" data-testid={`quadrant-${quadrant.key}-tasks`}>
                    {quadrantTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggleComplete={onToggleComplete}
                        onEdit={setEditingTask}
                        onDelete={onDeleteTask}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editingTask && (
        <TaskForm
          listId={selectedListId}
          task={editingTask}
          onSubmit={handleEdit}
          onCancel={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}
