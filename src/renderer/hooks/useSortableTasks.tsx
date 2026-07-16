import { useState, useCallback, useMemo } from 'react'
import type { TaskRow } from '../../shared/ipc'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'

interface UseSortableTasksReturn {
  DndProvider: ({ children }: { children: React.ReactNode }) => React.JSX.Element
  activeId: string | null
}

export function useSortableTasks(
  tasks: TaskRow[],
  selectedListId: number | null,
  onReorder: (reorderedTasks: TaskRow[]) => void
): UseSortableTasksReturn {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null)
      const { active, over } = event
      if (!over || active.id === over.id || selectedListId === null) return

      const oldIndex = tasks.findIndex((t) => t.id === Number(active.id))
      const newIndex = tasks.findIndex((t) => t.id === Number(over.id))
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(tasks, oldIndex, newIndex)
      onReorder(reordered)

      const taskIds = reordered.map((t) => t.id)
      try {
        await window.electronAPI.tasks.updateSortOrder(selectedListId, taskIds)
      } catch {
        // Reorder failed; the onReorder callback already updated local state
        // and useTasks refresh will reconcile
      }
    },
    [tasks, selectedListId, onReorder]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  const taskIds = useMemo(() => tasks.map((t) => String(t.id)), [tasks])

  const DndProvider = useCallback(
    ({ children }: { children: React.ReactNode }) => (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
      </DndContext>
    ),
    [sensors, handleDragStart, handleDragEnd, handleDragCancel, taskIds]
  )

  return { DndProvider, activeId }
}
