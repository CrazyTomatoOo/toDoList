/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { DataDirState } from '../../shared/ipc'
import App from '../../renderer/App'

// Mock hooks (same shape as App.test.tsx, trimmed to what the banner needs).
vi.mock('../../renderer/hooks/useLists', () => ({
  useLists: () => ({
    lists: [{ id: 1, name: 'Test List', task_count: 0 }],
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
    selectedListId: 1,
    selectList: vi.fn(),
    clearSelection: vi.fn(),
  }),
}))

vi.mock('../../renderer/hooks/useSearchAndFilter', () => ({
  useSearchAndFilter: () => ({
    query: '',
    setQuery: vi.fn(),
    priorityFilter: 'all',
    setPriorityFilter: vi.fn(),
    statusFilter: 'all',
    setStatusFilter: vi.fn(),
    recurrenceFilter: 'all',
    setRecurrenceFilter: vi.fn(),
    durationFilter: 'all',
    setDurationFilter: vi.fn(),
    quadrantFilter: 'all',
    setQuadrantFilter: vi.fn(),
    filteredTasks: [],
    isFiltering: false,
    loading: false,
  }),
}))

vi.mock('../../renderer/services/theme', () => ({
  useTheme: () => ({
    mode: 'light',
    resolved: 'light',
    toggle: vi.fn(),
    setMode: vi.fn(),
  }),
}))

const CONFIG_PATH = '/home/tester/.config/ToDoList/config.json'

function makeState(overrides: Partial<DataDirState> = {}): DataDirState {
  return {
    dir: '/home/tester/.local/share/todolist-app',
    defaultDir: '/home/tester/.local/share/todolist-app',
    source: 'default',
    isDefault: true,
    configPath: CONFIG_PATH,
    problem: {
      kind: 'invalid-json',
      detail: `配置文件不是合法 JSON：${CONFIG_PATH}（Unexpected end of JSON input）`,
      fingerprint: 'abc123',
    },
    noStore: false,
    backups: [],
    appVersion: '0.2.0-test',
    noticeAcknowledged: false,
    ...overrides,
  }
}

function stubElectronAPI(
  state: DataDirState | null = makeState(),
): { dataDir: { getState: ReturnType<typeof vi.fn>; ackNotice: ReturnType<typeof vi.fn> } } {
  const api = {
    dataDir: {
      getState: vi.fn(async () => state),
      reveal: vi.fn(async () => undefined),
      ackNotice: vi.fn(async () => undefined),
    },
    lists: {
      getWithTaskCount: vi.fn(async () => []),
      getAll: vi.fn(async () => []),
    },
    tasks: {
      getByListId: vi.fn(async () => []),
    },
    importExport: {
      importFile: vi.fn(),
      exportJson: vi.fn(),
      exportCsv: vi.fn(),
    },
    reminders: {
      onReminderClicked: vi.fn(() => vi.fn()),
    },
  }
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: api,
  })
  return api as typeof api & {
    dataDir: { getState: ReturnType<typeof vi.fn>; ackNotice: ReturnType<typeof vi.fn> }
  }
}

describe('配置未生效提示条 (issue #14)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // @ts-expect-error test fixture cleanup
    delete window.electronAPI
  })

  it('renders the banner between header and content with role=status when a problem is unacknowledged', async () => {
    stubElectronAPI(makeState())

    render(<App />)

    const banner = await screen.findByTestId('config-notice')
    expect(banner).toBeInTheDocument()
    expect(banner).toHaveAttribute('role', 'status')

    // Sits inside main-area, after the header, before the content.
    const main = screen.getByTestId('app-shell').querySelector('.main-area')
    expect(main).toContainElement(banner)
    expect(main?.querySelector('.main-header')).toBeInTheDocument()
    expect(
      // banner comes after the header in DOM order
      Boolean(
        main?.querySelector('.main-header ~ [data-testid="config-notice"]'),
      ),
    ).toBe(true)

    // One-line reason plus the monospace config path plus both actions.
    expect(screen.getByTestId('config-notice-reason')).toBeInTheDocument()
    expect(screen.getByTestId('config-notice-path')).toHaveTextContent(
      CONFIG_PATH,
    )
    expect(screen.getByTestId('config-notice-path')).toHaveClass(
      'config-notice-path',
    )
    expect(
      screen.getByRole('button', { name: '打开设置' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '知道了' })).toBeInTheDocument()
  })

  it('does not render the banner when there is no problem', async () => {
    stubElectronAPI(makeState({ problem: null }))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('search-filter-bar')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('config-notice')).not.toBeInTheDocument()
  })

  it('does not render the banner when the problem is already acknowledged', async () => {
    stubElectronAPI(makeState({ noticeAcknowledged: true }))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('search-filter-bar')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('config-notice')).not.toBeInTheDocument()
  })

  it('acknowledges via 知道了 and hides the banner without writing the fingerprint for 打开设置', async () => {
    const api = stubElectronAPI(makeState())

    render(<App />)
    await screen.findByTestId('config-notice')

    fireEvent.click(screen.getByRole('button', { name: '知道了' }))

    await waitFor(() => {
      expect(api.dataDir.ackNotice).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.queryByTestId('config-notice')).not.toBeInTheDocument()
    })
  })

  it('opens the settings page data tab via 打开设置 without acknowledging', async () => {
    const api = stubElectronAPI(makeState())

    render(<App />)
    await screen.findByTestId('config-notice')

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }))

    await waitFor(() => {
      expect(screen.getByTestId('settings-page')).toBeInTheDocument()
    })
    // The 数据 tab is shown directly.
    await waitFor(() => {
      expect(screen.getByTestId('settings-section-data')).toBeInTheDocument()
    })
    expect(api.dataDir.ackNotice).not.toHaveBeenCalled()
    // And the banner itself is gone with the content hidden behind settings.
  })

  it('keeps the banner out of focus on mount (no autofocus)', async () => {
    stubElectronAPI(makeState())

    render(<App />)
    const banner = await screen.findByTestId('config-notice')

    expect(banner).not.toHaveFocus()
    expect(banner.querySelector('button')).not.toHaveFocus()
    expect(document.activeElement).not.toBe(banner)
  })
})
