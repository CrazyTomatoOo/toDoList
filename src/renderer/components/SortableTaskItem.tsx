import { memo, useMemo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TaskRow } from '../../shared/ipc'
import TaskItem from './TaskItem'

interface SortableTaskItemProps {
  task: TaskRow
  onToggleComplete: (task: TaskRow) => Promise<void>
  onEdit: (task: TaskRow) => void
  onDelete: (id: number) => Promise<void>
}

function SortableTaskItem({
  task,
  onToggleComplete,
  onEdit,
  onDelete
}: SortableTaskItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(task.id)
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined
  }

  const dragHandleProps = useMemo(() => listeners, [listeners])

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <TaskItem
        task={task}
        onToggleComplete={onToggleComplete}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={dragHandleProps}
      />
    </div>
  )
}

export default memo(SortableTaskItem)
