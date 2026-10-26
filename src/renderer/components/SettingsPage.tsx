import { useEffect, useRef, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { ThemeController, ThemeMode } from '../services/theme'

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
}

/**
 * Full-main settings page (issue #11): left nav 通用 / 数据 / 关于.
 * The 通用 tab hosts the three-option theme picker.
 */
export default function SettingsPage({ theme, onExit }: SettingsPageProps) {
  const [section, setSection] = useState<SettingsSection>('general')
  const navRef = useRef<HTMLDivElement>(null)

  // Move focus into the nav when the page opens; restore is handled by App.
  useEffect(() => {
    const first = navRef.current?.querySelector<HTMLElement>(
      '[data-testid="settings-nav-general"]',
    )
    first?.focus()
  }, [])

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
            <p className="settings-hint">数据目录与备份管理即将推出。</p>
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
          </div>
        )}
      </div>
    </section>
  )
}
