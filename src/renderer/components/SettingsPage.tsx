import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import type { ThemeController, ThemeMode } from '../services/theme'
import type {
  DataDirState,
  ApplyDataDirResult,
} from '../../shared/ipc'

export type SettingsSection = 'general' | 'data' | 'about'

const THEME_OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: '跟随系统' },
  { mode: 'light', label: '浅色' },
  { mode: 'dark', label: '深色' },
]

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'data', label: '数据' },
  { id: 'about', label: '关于' },
]

interface SettingsPageProps {
  theme: ThemeController
  onExit: () => void
  /** Opening tab; the config notice banner jumps straight to 数据. */
  initialSection?: SettingsSection
}

/**
 * Full-main settings page (issue #11): left nav 通用 / 数据 / 关于.
 * The 通用 tab hosts the three-option theme picker.
 */
export default function SettingsPage({
  theme,
  onExit,
  initialSection = 'general',
}: SettingsPageProps) {
  const [section, setSection] = useState<SettingsSection>(initialSection)
  const navRef = useRef<HTMLDivElement>(null)

  // Move focus into the nav when the page opens; restore is handled by App.
  useEffect(() => {
    const first = navRef.current?.querySelector<HTMLElement>(
      '[data-testid="settings-nav-general"]',
    )
    first?.focus()
  }, [])

  const [dataDirState, setDataDirState] = useState<DataDirState | null>(null)
  const [dataDirError, setDataDirError] = useState<string | null>(null)

  // Load the data directory snapshot when the 数据 or 关于 tab is shown
  // (关于 displays the app version from the same snapshot).
  useEffect(() => {
    if (section !== 'data' && section !== 'about') {
      return
    }
    let cancelled = false
    window.electronAPI.dataDir
      .getState()
      .then((state) => {
        if (!cancelled) {
          setDataDirState(state)
          setDataDirError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataDirError('无法读取数据目录状态。')
        }
      })
    return () => {
      cancelled = true
    }
  }, [section])

  // Switch flow (issue #17): a validated target awaiting mode + confirmation.
  const [switchTarget, setSwitchTarget] = useState<string | null>(null)
  const [switchMode, setSwitchMode] = useState<'migrate' | 'empty'>('migrate')
  const [chooseFailure, setChooseFailure] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [applyStep, setApplyStep] = useState<string | null>(null)
  const [applying, setApplying] = useState(false)
  const [backupPendingDelete, setBackupPendingDelete] = useState<string | null>(
    null,
  )

  const resetSwitchFlow = () => {
    setSwitchTarget(null)
    setSwitchMode('migrate')
    setChooseFailure(null)
    setApplyError(null)
    setApplyStep(null)
    setApplying(false)
  }

  const handleChoose = async () => {
    setChooseFailure(null)
    setApplyError(null)
    setApplyStep(null)
    const result = await window.electronAPI.dataDir.choose()
    if (result.canceled) {
      return
    }
    if (result.failure) {
      setChooseFailure(result.failure)
      setSwitchTarget(null)
      return
    }
    setSwitchTarget(result.dir ?? null)
    setSwitchMode('migrate')
  }

  const handleRestoreDefault = () => {
    if (!dataDirState || dataDirState.isDefault) {
      return
    }
    resetSwitchFlow()
    setSwitchTarget(dataDirState.defaultDir)
    setSwitchMode('migrate')
  }

  const handleApply = async () => {
    if (!switchTarget || applying) {
      return
    }
    setApplying(true)
    setApplyError(null)
    setApplyStep(null)
    let result: ApplyDataDirResult | null = null
    try {
      result = await window.electronAPI.dataDir.apply({
        targetDir: switchTarget,
        mode: switchMode,
      })
    } catch {
      result = null
    }
    if (result && result.ok) {
      // Two-phase: the new directory takes effect on the next boot.
      await window.electronAPI.app.relaunch()
      return
    }
    const error =
      result && result.error
        ? result.error
        : { step: 'unknown', message: '与主进程通信失败，请重试。' }
    setApplyStep(error.step)
    setApplyError(error.message)
    setApplying(false)
  }

  const handleConfirmDeleteBackup = async () => {
    if (!backupPendingDelete) {
      return
    }
    const result = await window.electronAPI.dataDir.deleteBackup({
      path: backupPendingDelete,
    })
    setBackupPendingDelete(null)
    if (!result.ok) {
      setDataDirError(result.message ?? '删除备份失败。')
      return
    }
    // Refresh the snapshot so the row disappears.
    try {
      const state = await window.electronAPI.dataDir.getState()
      setDataDirState(state)
      setDataDirError(null)
    } catch {
      setDataDirError('无法读取数据目录状态。')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onExit()
    }
  }

  return (
    <section
      className="settings-page"
      data-testid="settings-page"
      onKeyDown={handleKeyDown}
    >
      <nav className="settings-nav" aria-label="设置导航" ref={navRef}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="settings-nav-item"
            data-testid={`settings-nav-${s.id}`}
            aria-current={section === s.id ? 'true' : undefined}
            onClick={() => setSection(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <div className="settings-pane">
        <div className="settings-pane-header">
          <button
            type="button"
            className="btn btn-ghost settings-back-button"
            data-testid="settings-back-button"
            onClick={onExit}
          >
            <ArrowLeft size={16} />
            返回列表
          </button>
        </div>

        {section === 'general' && (
          <div className="settings-section">
            <h2>通用</h2>
            <div className="settings-row">
              <span className="settings-row-label">主题</span>
              <div
                className="settings-segmented"
                role="group"
                aria-label="主题模式"
                data-testid="settings-theme-segmented"
              >
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    className="settings-segmented-item"
                    data-mode={opt.mode}
                    data-testid={`settings-theme-${opt.mode}`}
                    aria-pressed={theme.mode === opt.mode}
                    onClick={() => theme.setMode(opt.mode)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="settings-hint">
              跟随系统时，主题随操作系统的外观自动切换。
            </p>
          </div>
        )}

        {section === 'data' && (
          <div className="settings-section" data-testid="settings-section-data">
            <h2>数据</h2>
            {dataDirError && (
              <p className="settings-hint" data-testid="data-dir-error">
                {dataDirError}
              </p>
            )}
            {!dataDirError && !dataDirState && (
              <p className="settings-hint" data-testid="data-dir-loading">
                正在读取数据目录…
              </p>
            )}
            {dataDirState && (
              <>
                <div className="settings-row">
                  <span className="settings-row-label">数据目录</span>
                  <span
                    className={
                      dataDirState.isDefault
                        ? 'settings-badge settings-badge-default'
                        : 'settings-badge settings-badge-custom'
                    }
                    data-testid="data-dir-badge"
                  >
                    {dataDirState.isDefault ? '默认' : '自定义'}
                  </span>
                </div>
                <p className="settings-mono-path" data-testid="data-dir-path">
                  {dataDirState.dir}
                </p>
                <div className="settings-row settings-row-actions">
                  <span className="settings-row-label">数据位置</span>
                  <div className="settings-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      data-testid="data-dir-change-button"
                      disabled={applying}
                      onClick={() => {
                        void handleChoose()
                      }}
                    >
                      更改…
                    </button>
                    {!dataDirState.isDefault && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        data-testid="data-dir-restore-default-button"
                        disabled={applying}
                        onClick={handleRestoreDefault}
                      >
                        恢复默认
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      data-testid="data-dir-reveal-button"
                      onClick={() => {
                        void window.electronAPI.dataDir.reveal()
                      }}
                    >
                      <FolderOpen size={16} />
                      打开所在文件夹
                    </button>
                  </div>
                </div>

                {chooseFailure && (
                  <p
                    className="settings-hint settings-hint-error"
                    data-testid="data-dir-choose-failure"
                  >
                    {chooseFailure}
                  </p>
                )}

                {switchTarget && (
                  <div
                    className="settings-switch-panel"
                    data-testid="data-dir-switch-panel"
                  >
                    <p className="settings-hint">
                      目标目录：
                      <span data-testid="data-dir-switch-target">
                        {switchTarget}
                      </span>
                    </p>
                    <div
                      className="settings-mode-choice"
                      role="radiogroup"
                      aria-label="数据迁移方式"
                    >
                      <label className="settings-mode-option">
                        <input
                          type="radio"
                          name="data-dir-switch-mode"
                          value="migrate"
                          data-testid="data-dir-migrate-option"
                          checked={switchMode === 'migrate'}
                          onChange={() => setSwitchMode('migrate')}
                        />
                        迁移现有数据（推荐）
                      </label>
                      <label className="settings-mode-option">
                        <input
                          type="radio"
                          name="data-dir-switch-mode"
                          value="empty"
                          data-testid="data-dir-empty-option"
                          checked={switchMode === 'empty'}
                          onChange={() => setSwitchMode('empty')}
                        />
                        从空目录开始
                      </label>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      data-testid="data-dir-apply-button"
                      disabled={applying}
                      onClick={() => {
                        void handleApply()
                      }}
                    >
                      {applying ? '正在迁移…' : '迁移并重启'}
                    </button>
                    {applyError && (
                      <p
                        className="settings-hint settings-hint-error"
                        data-testid="data-dir-apply-error"
                      >
                        迁移失败（步骤：{applyStep ?? 'unknown'}）：{applyError}
                      </p>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost settings-switch-cancel"
                      data-testid="data-dir-cancel-switch"
                      disabled={applying}
                      onClick={resetSwitchFlow}
                    >
                      取消
                    </button>
                  </div>
                )}

                <div className="settings-row">
                  <span className="settings-row-label">引导配置</span>
                </div>
                <p
                  className="settings-mono-path"
                  data-testid="data-dir-config-path"
                >
                  {dataDirState.configPath}
                </p>

                {dataDirState.backups.length > 0 && (
                  <div className="settings-backup-block">
                    <h3>备份</h3>
                    <table
                      className="settings-backup-table"
                      data-testid="backup-table"
                    >
                      <thead>
                        <tr>
                          <th>目录</th>
                          <th>大小</th>
                          <th>创建时间</th>
                          <th>删除</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataDirState.backups.map((backup) => (
                          <tr key={backup.path} data-testid="backup-row">
                            <td className="settings-mono-path">
                              {basenameOf(backup.path)}
                            </td>
                            <td>{formatBytes(backup.sizeBytes)}</td>
                            <td>{formatDate(backup.createdAt)}</td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                data-testid="backup-delete-button"
                                onClick={() =>
                                  setBackupPendingDelete(backup.path)
                                }
                              >
                                删除
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {section === 'about' && (
          <div
            className="settings-section"
            data-testid="settings-section-about"
          >
            <h2>关于</h2>
            <p className="settings-hint">
              ToDoList — 离线优先的跨平台待办桌面应用。
            </p>
            <div className="settings-row">
              <span className="settings-row-label">版本</span>
              <span data-testid="about-app-version">
                {dataDirState ? dataDirState.appVersion : '…'}
              </span>
            </div>
          </div>
        )}

      {backupPendingDelete && (
        <div className="modal-overlay" onClick={() => setBackupPendingDelete(null)}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="确认删除备份"
            data-testid="backup-delete-confirm"
          >
            <h2>删除备份</h2>
            <p className="settings-hint">
              确定要删除备份「{basenameOf(backupPendingDelete)}」吗？此操作无法撤销。
            </p>
            <div className="settings-actions">
              <button
                type="button"
                className="btn btn-ghost"
                data-testid="backup-cancel-delete"
                onClick={() => setBackupPendingDelete(null)}
              >
                取消
              </button>
              <button
                type="button"
                className="btn btn-primary"
                data-testid="backup-confirm-delete"
                onClick={() => {
                  void handleConfirmDeleteBackup()
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </section>
  )
}

/** Last path segment — renderer-side basename (no node:path in renderer). */
function basenameOf(p: string): string {
  const trimmed = p.replace(/\/+$/, '')
  const idx = trimmed.lastIndexOf('/')
  return idx === -1 ? trimmed : trimmed.slice(idx + 1)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}
