import { useState, useCallback } from 'react'

export function useSelectedList() {
  const [selectedListId, setSelectedListId] = useState<number | null>(null)

  const selectList = useCallback((id: number) => {
    setSelectedListId(id)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedListId(null)
  }, [])

  return { selectedListId, selectList, clearSelection }
}
