import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, FolderOpen } from 'lucide-react'
import type { ThemeController, ThemeMode } from '../services/theme'
import type { DataDirState } from '../../shared/ipc'

type SettingsSection = 'general' | 'data' | 'about'

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
                <div className="settings-row">
                  <span className="settings-row-label">引导配置</span>
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
                <p
                  className="settings-mono-path"
                  data-testid="data-dir-config-path"
                >
                  {dataDirState.configPath}
                </p>
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
      </div>
    </section>
  )
}
