import { useState, useEffect, useCallback } from 'react'
import { Moon, Sun, Monitor, Plus } from 'lucide-react'
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
      window.alert(err instanceof Error ? err.message : '导入失败')
    }
  }, [refreshLists, refreshTasks])

  const handleExportJson = useCallback(async () => {
    try {
      await window.electronAPI.importExport.exportJson()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '导出失败')
    }
  }, [])

  const handleExportCsv = useCallback(async () => {
    try {
      await window.electronAPI.importExport.exportCsv()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '导出失败')
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
          <h1>{selectedList?.name ?? '未选择列表'}</h1>
          <div className="main-header-actions">
            {selectedListId !== null && (
              <div className="view-toggle" role="group" aria-label="视图模式">
                <button
                  className="view-toggle-btn"
                  onClick={() => setViewMode('list')}
                  data-testid="view-toggle-list"
                  aria-pressed={viewMode === 'list'}
                >
                  列表
                </button>
                <button
                  className="view-toggle-btn"
                  onClick={() => setViewMode('board')}
                  data-testid="view-toggle-board"
                  aria-pressed={viewMode === 'board'}
                >
                  看板
                </button>
              </div>
            )}
            <button
              className="btn btn-ghost btn-icon theme-toggle"
              onClick={toggleTheme}
              data-testid="theme-toggle"
              title={`主题：${themeMode}`}
              aria-label={`当前主题：${themeMode}。点击切换。`}
            >
              {themeMode === 'dark' ? <Moon size={20} /> : themeMode === 'light' ? <Sun size={20} /> : <Monitor size={20} />}
            </button>
            {selectedListId !== null && (
              <button
                className="btn btn-primary"
                onClick={() => setShowAddForm(true)}
                data-testid="add-task-button"
              >
                <Plus size={16} />
                添加任务
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
            emptyMessage={isFiltering ? '没有符合搜索条件的任务' : undefined}
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
