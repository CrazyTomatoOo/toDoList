/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SettingsPage from '../../renderer/components/SettingsPage'
import type { DataDirState, ElectronAPI } from '../../shared/ipc'

const themeController = {
  mode: 'light' as const,
  resolved: 'light' as const,
  toggle: vi.fn(),
  setMode: vi.fn(),
}

function makeDataDirState(overrides: Partial<DataDirState> = {}): DataDirState {
  return {
    dir: '/home/tester/Data/todolist',
    defaultDir: '/home/tester/.local/share/todolist-app',
    source: 'env',
    isDefault: false,
    configPath: '/home/tester/.config/ToDoList/config.json',
    problem: null,
    noStore: false,
    backups: [],
    appVersion: '0.2.0-test',
    ...overrides,
  }
}

function stubElectronAPI(dataDir: Partial<ElectronAPI['dataDir']> = {}) {
  const api = {
    dataDir: {
      getState: vi.fn(async () => makeDataDirState()),
      reveal: vi.fn(async () => undefined),
      ...dataDir,
    },
  }
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: api,
  })
  return api
}

describe('SettingsPage 数据 tab (issue #13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // @ts-expect-error test fixture cleanup
    delete window.electronAPI
  })

  it('shows the custom badge and the full monospace path for a custom directory', async () => {
    stubElectronAPI()

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))

    await waitFor(() => {
      expect(screen.getByTestId('data-dir-path')).toHaveTextContent(
        '/home/tester/Data/todolist',
      )
    })

    const badge = screen.getByTestId('data-dir-badge')
    expect(badge).toHaveTextContent('自定义')
    expect(screen.getByTestId('data-dir-config-path')).toHaveTextContent(
      '/home/tester/.config/ToDoList/config.json',
    )
  })

  it('shows the default badge when the directory is the default one', async () => {
    stubElectronAPI({
      getState: vi.fn(async () =>
        makeDataDirState({
          dir: '/home/tester/.local/share/todolist-app',
          isDefault: true,
          source: 'default',
        }),
      ),
    })

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))

    await waitFor(() => {
      expect(screen.getByTestId('data-dir-badge')).toHaveTextContent('默认')
    })
  })

  it('reveals the data directory when 打开所在文件夹 is clicked', async () => {
    const api = stubElectronAPI()

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))

    await waitFor(() => {
      expect(screen.getByTestId('data-dir-reveal-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('data-dir-reveal-button'))

    expect(api.dataDir.reveal).toHaveBeenCalledTimes(1)
  })

  it('shows an error hint when getState rejects', async () => {
    stubElectronAPI({
      getState: vi.fn(async () => {
        throw new Error('boom')
      }),
    })

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))

    await waitFor(() => {
      expect(screen.getByTestId('data-dir-error')).toBeInTheDocument()
    })
  })

  it('does not offer 更改 or 恢复默认 in this ticket', async () => {
    stubElectronAPI()

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))

    await waitFor(() => {
      expect(screen.getByTestId('data-dir-path')).toBeInTheDocument()
    })

    expect(screen.queryByText('更改…')).not.toBeInTheDocument()
    expect(screen.queryByText('恢复默认')).not.toBeInTheDocument()
  })
})

describe('SettingsPage 关于 tab (issue #13)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // @ts-expect-error test fixture cleanup
    delete window.electronAPI
  })

  it('shows the app version from the data-dir snapshot', async () => {
    stubElectronAPI({
      getState: vi.fn(async () => makeDataDirState({ appVersion: '1.4.2' })),
    })

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-about'))

    await waitFor(() => {
      expect(screen.getByTestId('about-app-version')).toHaveTextContent('1.4.2')
    })
  })
})
