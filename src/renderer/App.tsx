import { useState, useEffect, useCallback } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import type { TaskRow, CreateTaskInput, UpdateTaskInput } from '../shared/ipc'
import { useLists } from './hooks/useLists'
import { useTasks } from './hooks/useTasks'
import { useSelectedList } from './hooks/useSelectedList'
import { useSearchAndFilter } from './hooks/useSearchAndFilter'
import { useTheme } from './services/theme'
import ListSidebar from './components/ListSidebar'
import TaskList from './components/TaskList'
import SearchBar from './components/SearchBar'
import FilterBar from './components/FilterBar'
import ImportExportButtons from './components/ImportExportButtons'
import QuadrantBoard from './components/QuadrantBoard'
import './styles.css'

export default function App() {
  const [showAddForm, setShowAddForm] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const { mode: themeMode, toggle: toggleTheme } = useTheme()
  const { lists, loading: listsLoading, createList, updateList, deleteList, refresh: refreshLists } = useLists()
  const { selectedListId, selectList, clearSelection } = useSelectedList()
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    createTask,
    updateTask,
    deleteTask,
    toggleComplete,
    refresh: refreshTasks
  } = useTasks(selectedListId)

  const {
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
    loading: searchLoading
  } = useSearchAndFilter(tasks, selectedListId)

  // Auto-select first list when lists load
  useEffect(() => {
    if (lists.length > 0 && selectedListId === null) {
      selectList(lists[0].id)
    } else if (lists.length > 0 && !lists.some((l) => l.id === selectedListId)) {
      selectList(lists[0].id)
    } else if (lists.length === 0) {
      clearSelection()
    }
  }, [lists, selectedListId, selectList, clearSelection])

  // Focus the list when the user clicks a reminder notification.
  useEffect(() => {
    const unsubscribe = window.electronAPI.reminders.onReminderClicked((payload) => {
      selectList(payload.listId)
    })
    return unsubscribe
  }, [selectList])


  const handleDeleteList = useCallback(
    async (id: number) => {
      await deleteList(id)
    },
    [deleteList]
  )

  const handleCreateTask = useCallback(
    async (input: CreateTaskInput) => {
      await createTask(input)
      await refreshLists()
    },
    [createTask, refreshLists]
  )

  const handleUpdateTask = useCallback(
    async (id: number, input: Partial<UpdateTaskInput>) => {
      await updateTask(id, input)
      await refreshLists()
    },
    [updateTask, refreshLists]
  )

  const handleDeleteTask = useCallback(
    async (id: number) => {
      await deleteTask(id)
      await refreshLists()
    },
    [deleteTask, refreshLists]
  )

  const handleToggleComplete = useCallback(
    async (task: TaskRow) => {
      await toggleComplete(task)
      await refreshLists()
    },
    [toggleComplete, refreshLists]
  )

  const handleReorder = useCallback(() => {
    refreshTasks()
  }, [refreshTasks])

  const handleImport = useCallback(async () => {
    try {
      await window.electronAPI.importExport.importFile()
      await refreshLists()
      await refreshTasks()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Import failed')
    }
  }, [refreshLists, refreshTasks])

  const handleExportJson = useCallback(async () => {
    try {
      await window.electronAPI.importExport.exportJson()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Export failed')
    }
  }, [])

  const handleExportCsv = useCallback(async () => {
    try {
      await window.electronAPI.importExport.exportCsv()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Export failed')
    }
  }, [])

  const selectedList = lists.find((l) => l.id === selectedListId)

  return (
    <div className="app-layout" data-testid="app-shell">
      <ListSidebar
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={selectList}
        onCreateList={async (name) => { await createList(name) }}
        onUpdateList={async (id, name) => { await updateList(id, name) }}
        onDeleteList={handleDeleteList}
        loading={listsLoading}
      />

      <main className="main-area">
        <div className="main-header">
          <h1>{selectedList?.name ?? 'No List Selected'}</h1>
          <div className="main-header-actions">
            {selectedListId !== null && (
              <div className="view-toggle" role="group" aria-label="View mode">
                <button
                  className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setViewMode('list')}
                  data-testid="view-toggle-list"
                  aria-pressed={viewMode === 'list'}
                >
                  List
                </button>
                <button
                  className={`btn btn-sm ${viewMode === 'board' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setViewMode('board')}
                  data-testid="view-toggle-board"
                  aria-pressed={viewMode === 'board'}
                >
                  Board
                </button>
              </div>
            )}
            <button
              className="btn btn-ghost btn-icon"
              onClick={toggleTheme}
              data-testid="theme-toggle"
              title={`Theme: ${themeMode}`}
              aria-label={`Current theme: ${themeMode}. Click to change.`}
            >
              {themeMode === 'dark' ? <Moon size={20} /> : themeMode === 'light' ? <Sun size={20} /> : <Monitor size={20} />}
            </button>
            {selectedListId !== null && (
              <button
                className="btn btn-primary"
                onClick={() => setShowAddForm(true)}
                data-testid="add-task-button"
              >
                + Add Task
              </button>
            )}
            <ImportExportButtons
              onImport={handleImport}
              onExportJson={handleExportJson}
              onExportCsv={handleExportCsv}
            />
          </div>
        </div>

        {selectedListId !== null && viewMode === 'list' && (
          <div className="search-filter-bar" data-testid="search-filter-bar">
            <SearchBar query={query} onQueryChange={setQuery} />
            <FilterBar
              priorityFilter={priorityFilter}
              onPriorityChange={setPriorityFilter}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              recurrenceFilter={recurrenceFilter}
              onRecurrenceChange={setRecurrenceFilter}
              durationFilter={durationFilter}
              onDurationChange={setDurationFilter}
              quadrantFilter={quadrantFilter}
              onQuadrantChange={setQuadrantFilter}
            />
          </div>
        )}

        {viewMode === 'list' ? (
          <TaskList
            tasks={filteredTasks}
            selectedListId={selectedListId}
            loading={tasksLoading || searchLoading}
            error={tasksError}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onToggleComplete={handleToggleComplete}
            onReorder={handleReorder}
            showAddForm={showAddForm}
            onOpenAddForm={() => setShowAddForm(true)}
            onCloseAddForm={() => setShowAddForm(false)}
            emptyMessage={isFiltering ? 'No tasks match your search' : undefined}
          />
        ) : (
          <QuadrantBoard
            tasks={tasks}
            selectedListId={selectedListId}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
            onToggleComplete={handleToggleComplete}
          />
        )}
      </main>
    </div>
  )
}
