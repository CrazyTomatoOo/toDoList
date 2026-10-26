import { useState, useEffect, useCallback } from 'react'
import { Settings, Plus } from 'lucide-react'
import type {
  TaskRow,
  CreateTaskInput,
  UpdateTaskInput,
  DataDirState,
} from '../shared/ipc'
import { useLists } from './hooks/useLists'
import { useTasks } from './hooks/useTasks'
import { useSelectedList } from './hooks/useSelectedList'
import { useSearchAndFilter } from './hooks/useSearchAndFilter'
import { useTheme } from './services/theme'
import ListSidebar from './components/ListSidebar'
import SettingsPage from './components/SettingsPage'
import ConfigNotice from './components/ConfigNotice'
import NoStoreScreen from './components/NoStoreScreen'
import TaskList from './components/TaskList'
import SearchBar from './components/SearchBar'
import FilterBar from './components/FilterBar'
import ImportExportButtons from './components/ImportExportButtons'
import QuadrantBoard from './components/QuadrantBoard'
import './styles.css'

/**
 * 应用根组件 (issue #15).
 *
 * First resolves the data directory snapshot via data-dir:getState. When the
 * configured directory is unusable (noStore) the app renders the full-screen
 * safe mode INSTEAD of the shell — the shell's hooks (useTheme, useLists, …)
 * all touch the database at mount, and mounting them in safe mode would create
 * a database at the boot-time default userData, which safe mode must never do.
 */
export default function App() {
  const [boot, setBoot] = useState<
    | { kind: 'loading' }
    | { kind: 'noStore'; state: DataDirState }
    | { kind: 'ready'; state: DataDirState | null }
  >({ kind: 'loading' })
  const [retrying, setRetrying] = useState(false)
  const [chooseError, setChooseError] = useState<string | null>(null)

  const loadState = useCallback(() => {
    return window.electronAPI.dataDir
      .getState()
      .then((state) => {
        setBoot(
          state.noStore
            ? { kind: 'noStore', state }
            : { kind: 'ready', state },
        )
      })
      .catch(() => {
        // Fail open: without a snapshot render the normal app — any database
        // access errors then surface through the usual hook error states.
        setBoot({ kind: 'ready', state: null })
      })
  }, [])

  useEffect(() => {
    void loadState()
  }, [loadState])

  const handleRetry = useCallback(async () => {
    setRetrying(true)
    try {
      await loadState()
    } finally {
      setRetrying(false)
    }
  }, [loadState])

  const handleChoose = useCallback(async () => {
    setChooseError(null)
    try {
      const result = await window.electronAPI.dataDir.choose()
      if (result.canceled) {
        return
      }
      if (result.failure) {
        setChooseError(result.failure)
        return
      }
      // A valid directory was committed; restart into it.
      await window.electronAPI.app.relaunch()
    } catch (error) {
      setChooseError(error instanceof Error ? error.message : '选择目录失败')
    }
  }, [])

  const handleExit = useCallback(() => {
    void window.electronAPI.app.quit()
  }, [])

  if (boot.kind === 'loading') {
    return null
  }

  if (boot.kind === 'noStore') {
    return (
      <NoStoreScreen
        state={boot.state}
        retrying={retrying}
        chooseError={chooseError}
        onRetry={handleRetry}
        onChoose={handleChoose}
        onExit={handleExit}
      />
    )
  }

  return <MainApp configNotice={boot.state} />
}

interface MainAppProps {
  configNotice: DataDirState | null
}

/** The normal application shell (list sidebar + task area). */
function MainApp({ configNotice }: MainAppProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [noticeHidden, setNoticeHidden] = useState(false)
  const theme = useTheme()
  const {
    lists,
    loading: listsLoading,
    createList,
    updateList,
    deleteList,
    refresh: refreshLists,
  } = useLists()
  const { selectedListId, selectList, clearSelection } = useSelectedList()
  const {
    tasks,
    loading: tasksLoading,
    error: tasksError,
    createTask,
    updateTask,
    deleteTask,
    toggleComplete,
    refresh: refreshTasks,
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
    loading: searchLoading,
  } = useSearchAndFilter(tasks, selectedListId)

  // Auto-select first list when lists load
  useEffect(() => {
    if (lists.length > 0 && selectedListId === null) {
      selectList(lists[0].id)
    } else if (
      lists.length > 0 &&
      !lists.some((l) => l.id === selectedListId)
    ) {
      selectList(lists[0].id)
    } else if (lists.length === 0) {
      clearSelection()
    }
  }, [lists, selectedListId, selectList, clearSelection])

  // Focus the list when the user clicks a reminder notification.
  useEffect(() => {
    const unsubscribe = window.electronAPI.reminders.onReminderClicked(
      (payload) => {
        selectList(payload.listId)
      },
    )
    return unsubscribe
  }, [selectList])

  const handleDeleteList = useCallback(
    async (id: number) => {
      await deleteList(id)
    },
    [deleteList],
  )

  const handleCreateTask = useCallback(
    async (input: CreateTaskInput) => {
      await createTask(input)
      await refreshLists()
    },
    [createTask, refreshLists],
  )

  const handleUpdateTask = useCallback(
    async (id: number, input: Partial<UpdateTaskInput>) => {
      await updateTask(id, input)
      await refreshLists()
    },
    [updateTask, refreshLists],
  )

  const handleDeleteTask = useCallback(
    async (id: number) => {
      await deleteTask(id)
      await refreshLists()
    },
    [deleteTask, refreshLists],
  )

  const handleToggleComplete = useCallback(
    async (task: TaskRow) => {
      await toggleComplete(task)
      await refreshLists()
    },
    [toggleComplete, refreshLists],
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
        onCreateList={async (name) => {
          await createList(name)
        }}
        onUpdateList={async (id, name) => {
          await updateList(id, name)
        }}
        onDeleteList={handleDeleteList}
        loading={listsLoading}
      />

      <main className="main-area">
        <div className="main-header">
          <h1>{selectedList?.name ?? '未选择列表'}</h1>
          <div className="main-header-actions">
            {!settingsOpen && selectedListId !== null && (
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
              className="btn btn-ghost btn-icon settings-button"
              onClick={() => setSettingsOpen(true)}
              data-testid="settings-button"
              title="设置"
              aria-label="设置"
            >
              <Settings size={20} />
            </button>
            {!settingsOpen && selectedListId !== null && (
              <button
                className="btn btn-primary"
                onClick={() => setShowAddForm(true)}
                data-testid="add-task-button"
              >
                <Plus size={16} />
                添加任务
              </button>
            )}
            {!settingsOpen && (
              <ImportExportButtons
                onImport={handleImport}
                onExportJson={handleExportJson}
                onExportCsv={handleExportCsv}
              />
            )}
          </div>
        </div>

        {configNotice?.problem &&
          !configNotice.noticeAcknowledged &&
          !noticeHidden && (
          <ConfigNotice
            problem={configNotice.problem}
            configPath={configNotice.configPath}
            onOpenSettings={() => setSettingsOpen(true)}
            onAcknowledge={() => {
              setNoticeHidden(true)
              window.electronAPI.dataDir.ackNotice().catch(() => {
                // The main process already degrades to re-showing the notice
                // next launch when the acknowledgement cannot be persisted.
              })
            }}
          />
        )}

        {!settingsOpen && selectedListId !== null && viewMode === 'list' && (
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

        {settingsOpen ? (
          <SettingsPage
            theme={theme}
            onExit={() => setSettingsOpen(false)}
            initialSection="data"
          />
        ) : viewMode === 'list' ? (
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
