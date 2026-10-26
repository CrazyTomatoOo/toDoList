/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../../renderer/App'
import type { DataDirState } from '../../shared/ipc'

// The shell hooks touch the database; in safe mode they must never mount, but
// App.tsx still imports them statically, so mock them (like App.test.tsx).
vi.mock('../../renderer/hooks/useLists', () => ({
  useLists: () => ({
    lists: [],
    loading: false,
    createList: vi.fn(),
    updateList: vi.fn(),
    deleteList: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('../../renderer/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [],
    loading: false,
    error: null,
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    toggleComplete: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('../../renderer/hooks/useSelectedList', () => ({
  useSelectedList: () => ({
    selectedListId: null,
    selectList: vi.fn(),
    clearSelection: vi.fn(),
  }),
}))

vi.mock('../../renderer/hooks/useSearchAndFilter', () => ({
  useSearchAndFilter: () => ({
    query: '',
    setQuery: vi.fn(),
    priorityFilter: '',
    setPriorityFilter: vi.fn(),
    statusFilter: 'all',
    setStatusFilter: vi.fn(),
    recurrenceFilter: '',
    setRecurrenceFilter: vi.fn(),
    durationFilter: 'all',
    setDurationFilter: vi.fn(),
    quadrantFilter: '',
    setQuadrantFilter: vi.fn(),
    filteredTasks: [],
    isFiltering: false,
    loading: false,
  }),
}))

vi.mock('../../renderer/services/theme', () => ({
  useTheme: () => ({ mode: 'light', toggle: vi.fn(), setMode: vi.fn() }),
}))

const noStoreState: DataDirState = {
  dir: '/Volumes/default-data',
  defaultDir: '/Volumes/default-data',
  source: 'config',
  isDefault: false,
  configPath: '/Users/me/Library/Application Support/ToDoList/config.json',
  problem: {
    kind: 'unusable-dir',
    detail: '配置的数据目录不可用（不可写）：/Volumes/removed-drive/data',
    fingerprint: 'abc',
  },
  noStore: true,
  backups: [],
  appVersion: '0.2.0',
  noticeAcknowledged: false,
}

function mockElectronAPI(overrides: Record<string, unknown> = {}) {
  const api = {
    dataDir: {
      getState: vi.fn(async () => noStoreState),
      choose: vi.fn(async () => ({ canceled: false, dir: '/new/dir' })),
      reveal: vi.fn(async () => undefined),
      ackNotice: vi.fn(async () => undefined),
    },
    app: {
      relaunch: vi.fn(async () => undefined),
      quit: vi.fn(async () => undefined),
    },
    ...overrides,
  }
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: api })
  return api
}

beforeEach(() => {
  mockElectronAPI()
})

describe('NoStoreScreen (issue #15 safe mode)', () => {
  it('renders the full-screen safe mode with the three buttons, no sidebar', async () => {
    render(<App />)

    expect(await screen.findByTestId('no-store-screen')).toBeInTheDocument()
    expect(screen.getByTestId('no-store-retry')).toHaveTextContent('重试')
    expect(screen.getByTestId('no-store-choose')).toHaveTextContent('选择其他目录')
    expect(screen.getByTestId('no-store-exit')).toHaveTextContent('退出')

    // The app shell (and its sidebar) never mounts in safe mode.
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument()
    expect(screen.queryByTestId('list-sidebar')).not.toBeInTheDocument()

    // Reason and the exact directory (monospace) are shown.
    expect(screen.getByTestId('no-store-reason')).toHaveTextContent(
      '配置的数据目录不可用',
    )
    expect(screen.getByTestId('no-store-path')).toHaveTextContent(
      '/Volumes/removed-drive/data',
    )
  })

  it('invokes choose when 选择其他目录 is clicked', async () => {
    const api = mockElectronAPI()
    render(<App />)
    await screen.findByTestId('no-store-screen')

    fireEvent.click(screen.getByTestId('no-store-choose'))

    expect(api.dataDir.choose).toHaveBeenCalledTimes(1)
  })

  it('relaunches after a successful choose and stays on the screen until then', async () => {
    const api = mockElectronAPI()
    render(<App />)
    await screen.findByTestId('no-store-screen')

    fireEvent.click(screen.getByTestId('no-store-choose'))
    await screen.findByTestId('no-store-screen')

    expect(api.app.relaunch).toHaveBeenCalledTimes(1)
    expect(api.app.quit).not.toHaveBeenCalled()
  })

  it('shows the failure reason and does not relaunch when choose rejects the directory', async () => {
    const api = mockElectronAPI({
      dataDir: {
        getState: vi.fn(async () => noStoreState),
        choose: vi.fn(async () => ({ canceled: false, failure: '位于系统目录' })),
        reveal: vi.fn(async () => undefined),
        ackNotice: vi.fn(async () => undefined),
      },
    })
    render(<App />)
    await screen.findByTestId('no-store-screen')

    fireEvent.click(screen.getByTestId('no-store-choose'))

    expect(await screen.findByTestId('no-store-error')).toHaveTextContent(
      '位于系统目录',
    )
    expect(api.app.relaunch).not.toHaveBeenCalled()
  })

  it('quits without relaunching when 退出 is clicked', async () => {
    const api = mockElectronAPI()
    render(<App />)
    await screen.findByTestId('no-store-screen')

    fireEvent.click(screen.getByTestId('no-store-exit'))

    expect(api.app.quit).toHaveBeenCalledTimes(1)
    expect(api.app.relaunch).not.toHaveBeenCalled()
  })
})