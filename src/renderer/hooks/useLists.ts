import { useState, useEffect, useCallback } from 'react'
import type { ListWithTaskCount, ListRow } from '../../shared/ipc'

interface UseListsReturn {
  lists: ListWithTaskCount[]
  loading: boolean
  error: string | null
  createList: (name: string) => Promise<ListRow>
  updateList: (id: number, name: string) => Promise<ListRow>
  deleteList: (id: number) => Promise<void>
  refresh: () => Promise<void>
}

export function useLists(): UseListsReturn {
  const [lists, setLists] = useState<ListWithTaskCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await window.electronAPI.lists.getWithTaskCount()
      setLists(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lists')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createList = useCallback(async (name: string): Promise<ListRow> => {
    const result = await window.electronAPI.lists.create(name)
    await refresh()
    return result
  }, [refresh])

  const updateList = useCallback(async (id: number, name: string): Promise<ListRow> => {
    const result = await window.electronAPI.lists.update(id, name)
    await refresh()
    return result
  }, [refresh])

  const deleteList = useCallback(async (id: number): Promise<void> => {
    await window.electronAPI.lists.delete(id)
    await refresh()
  }, [refresh])

  return { lists, loading, error, createList, updateList, deleteList, refresh }
}
