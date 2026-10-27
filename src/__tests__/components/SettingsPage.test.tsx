/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
      apply: vi.fn(async () => ({ ok: true, warnings: [] })),
      deleteBackup: vi.fn(async () => ({ ok: true })),
      ...dataDir,
    },
    app: {
      relaunch: vi.fn(async () => undefined),
      quit: vi.fn(async () => undefined),
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

  it('runs the switch flow: 更改… → 迁移现有数据 default-checked → offers 立即重启 / 稍后', async () => {
    const api = stubElectronAPI()
    api.dataDir.choose = vi.fn(
      async () => ({ canceled: false, dir: '/home/tester/NewData' }) as const,
    )
    api.dataDir.apply = vi.fn(
      async () =>
        ({ ok: true, warnings: [], backupPath: '/back/todo-data-backup-x' }) as const,
    )

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-path')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('更改…'))
    await waitFor(() => {
      expect(api.dataDir.choose).toHaveBeenCalledTimes(1)
    })

    // In-place binary choice with 迁移现有数据 preselected.
    expect(screen.getByTestId('data-dir-migrate-option')).toBeChecked()
    expect(screen.getByTestId('data-dir-empty-option')).not.toBeChecked()
    expect(
      screen.getByTestId('data-dir-switch-target'),
    ).toHaveTextContent('/home/tester/NewData')

    fireEvent.click(screen.getByTestId('data-dir-apply-button'))
    await waitFor(() => {
      expect(api.dataDir.apply).toHaveBeenCalledWith({
        targetDir: '/home/tester/NewData',
        mode: 'migrate',
      })
    })

    // The new directory only takes effect on the next boot, so the restart is
    // offered rather than forced.
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-migrated-panel')).toBeInTheDocument()
    })
    expect(screen.getByTestId('data-dir-migrated-target')).toHaveTextContent(
      '/home/tester/NewData',
    )
    expect(api.app.relaunch).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('data-dir-restart-now'))
    await waitFor(() => {
      expect(api.app.relaunch).toHaveBeenCalledTimes(1)
    })
  })

  it('dismisses the migrated panel on 稍后 without relaunching', async () => {
    const api = stubElectronAPI()
    api.dataDir.choose = vi.fn(
      async () => ({ canceled: false, dir: '/home/tester/NewData' }) as const,
    )
    api.dataDir.apply = vi.fn(
      async () => ({ ok: true, warnings: [] }) as const,
    )

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-path')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('更改…'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-switch-target')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('data-dir-apply-button'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-migrated-panel')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('data-dir-restart-later'))
    expect(
      screen.queryByTestId('data-dir-migrated-panel'),
    ).not.toBeInTheDocument()
    expect(api.app.relaunch).not.toHaveBeenCalled()
  })

  it('passes mode empty when 从空目录开始 is selected', async () => {
    const api = stubElectronAPI()
    api.dataDir.choose = vi.fn(
      async () => ({ canceled: false, dir: '/home/tester/NewData' }) as const,
    )

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-path')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('更改…'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-apply-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('data-dir-empty-option'))
    fireEvent.click(screen.getByTestId('data-dir-apply-button'))

    await waitFor(() => {
      expect(api.dataDir.apply).toHaveBeenCalledWith({
        targetDir: '/home/tester/NewData',
        mode: 'empty',
      })
    })
  })

  it('shows the choose failure reason in place and does not call apply', async () => {
    const api = stubElectronAPI()
    api.dataDir.choose = vi.fn(
      async () => ({ canceled: false, failure: '该目录不可写' }) as const,
    )

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-path')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('更改…'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-choose-failure')).toHaveTextContent(
        '该目录不可写',
      )
    })
    expect(screen.queryByTestId('data-dir-apply-button')).not.toBeInTheDocument()
    expect(api.dataDir.apply).not.toHaveBeenCalled()
  })

  it('renders the failed step and reason below the button and does not relaunch', async () => {
    const api = stubElectronAPI()
    api.dataDir.choose = vi.fn(
      async () => ({ canceled: false, dir: '/home/tester/NewData' }) as const,
    )
    api.dataDir.apply = vi.fn(
      async () =>
        ({
          ok: false,
          error: { step: 'copy', message: '复制数据库文件失败：权限不足' },
          warnings: [],
        }) as const,
    )

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-path')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('更改…'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-apply-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('data-dir-apply-button'))

    await waitFor(() => {
      expect(screen.getByTestId('data-dir-apply-error')).toHaveTextContent(
        '复制数据库文件失败：权限不足',
      )
    })
    expect(screen.getByTestId('data-dir-apply-error')).toHaveTextContent('copy')
    expect(api.app.relaunch).not.toHaveBeenCalled()
  })

  it('shows 恢复默认 only for a custom directory and targets defaultDir', async () => {
    const api = stubElectronAPI()
    api.dataDir.choose = vi.fn(
      async () =>
        ({ canceled: false, dir: '/home/tester/.local/share/todolist-app' }) as const,
    )

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-path')).toBeInTheDocument()
    })

    // Custom dir → button visible.
    fireEvent.click(screen.getByText('恢复默认'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-apply-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('data-dir-apply-button'))
    await waitFor(() => {
      expect(api.dataDir.apply).toHaveBeenCalledWith({
        targetDir: '/home/tester/.local/share/todolist-app',
        mode: 'migrate',
      })
    })
  })

  it('hides 恢复默认 when the directory is the default one', async () => {
    stubElectronAPI({
      getState: vi.fn(async () =>
        makeDataDirState({
          dir: '/home/tester/.local/share/todolist-app',
          isDefault: true,
        }),
      ),
    })

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))
    await waitFor(() => {
      expect(screen.getByTestId('data-dir-path')).toBeInTheDocument()
    })

    expect(screen.queryByText('恢复默认')).not.toBeInTheDocument()
  })
})

describe('SettingsPage 数据 tab backup management (issue #17)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    delete (window as { electronAPI?: unknown }).electronAPI
  })

  it('renders the backup table with 目录/大小/创建时间/删除 and the backup name', async () => {
    stubElectronAPI({
      getState: vi.fn(async () =>
        makeDataDirState({
          backups: [
            {
              path: '/home/tester/Data/todo-data-backup-2026-01-02T03-04-05-000Z',
              sizeBytes: 4096,
              createdAt: '2026-01-02T03:04:05.000Z',
            },
          ],
        }),
      ),
    })

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))

    await waitFor(() => {
      expect(screen.getByTestId('backup-table')).toBeInTheDocument()
    })
    const table = screen.getByTestId('backup-table')
    expect(within(table).getByText('目录')).toBeInTheDocument()
    expect(within(table).getByText('大小')).toBeInTheDocument()
    expect(within(table).getByText('创建时间')).toBeInTheDocument()
    expect(within(table).getAllByText('删除').length).toBeGreaterThan(0)
    expect(
      screen.getByText('todo-data-backup-2026-01-02T03-04-05-000Z'),
    ).toBeInTheDocument()
  })

  it('requires a double confirmation before deleting a backup', async () => {
    const api = stubElectronAPI({
      getState: vi.fn(async () =>
        makeDataDirState({
          backups: [
            {
              path: '/home/tester/Data/todo-data-backup-old',
              sizeBytes: 1024,
              createdAt: '2026-01-02T03:04:05.000Z',
            },
          ],
        }),
      ),
    })

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))
    await waitFor(() => {
      expect(screen.getByTestId('backup-table')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('backup-delete-button'))
    // Modal is up; nothing deleted yet.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(api.dataDir.deleteBackup).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('backup-confirm-delete'))
    await waitFor(() => {
      expect(api.dataDir.deleteBackup).toHaveBeenCalledWith({
        path: '/home/tester/Data/todo-data-backup-old',
      })
    })
  })

  it('cancelling the confirm modal does not delete', async () => {
    const api = stubElectronAPI({
      getState: vi.fn(async () =>
        makeDataDirState({
          backups: [
            {
              path: '/home/tester/Data/todo-data-backup-old',
              sizeBytes: 1024,
              createdAt: '2026-01-02T03:04:05.000Z',
            },
          ],
        }),
      ),
    })

    render(<SettingsPage theme={themeController} onExit={vi.fn()} />)
    fireEvent.click(screen.getByTestId('settings-nav-data'))
    await waitFor(() => {
      expect(screen.getByTestId('backup-table')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('backup-delete-button'))
    fireEvent.click(screen.getByTestId('backup-cancel-delete'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(api.dataDir.deleteBackup).not.toHaveBeenCalled()
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
