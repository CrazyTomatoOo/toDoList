import { AlertTriangle } from 'lucide-react'
import type { DataDirState } from '../../shared/ipc'

interface NoStoreScreenProps {
  state: DataDirState
  retrying: boolean
  chooseError: string | null
  onRetry: () => void
  onChoose: () => void
  onExit: () => void
}

/**
 * 安全模式全屏 (issue #15, ADR-0005).
 *
 * Rendered instead of the entire app shell when the configured data directory
 * is unusable: the sidebar and task area never mount, and — critically — no
 * database is opened or created. The reason and the exact directory are shown,
 * followed by 重试 / 选择其他目录 / 退出.
 *
 * role="alert" is used here (unlike ConfigNotice's role="status") because this
 * screen *is* the whole application state, not an auxiliary banner.
 */
export default function NoStoreScreen({
  state,
  retrying,
  chooseError,
  onRetry,
  onChoose,
  onExit,
}: NoStoreScreenProps) {
  const detail = state.problem?.detail ?? ''
  const reason = detail.split('：')[0] || '数据目录不可用'
  const dir = detail.includes('：')
    ? detail.slice(detail.lastIndexOf('：') + 1)
    : ''

  return (
    <div className="no-store-screen" data-testid="no-store-screen">
      <div className="no-store-card" role="alert" aria-label="数据目录不可用">
        <AlertTriangle size={32} className="no-store-icon" />
        <h1 className="no-store-title">无法访问数据目录</h1>
        <p className="no-store-reason" data-testid="no-store-reason">
          {reason}
        </p>
        {dir && (
          <code className="no-store-path" data-testid="no-store-path">
            {dir}
          </code>
        )}
        <p className="no-store-hint">
          应用未创建或打开任何数据库，你的任务数据没有丢失。请重新连接存储设备、
          修复目录权限，或选择一个其他可用目录。
        </p>

        {chooseError && (
          <div className="no-store-error" role="alert" data-testid="no-store-error">
            {chooseError}
          </div>
        )}

        <div className="no-store-actions">
          <button
            type="button"
            className="btn btn-primary"
            data-testid="no-store-retry"
            onClick={onRetry}
            disabled={retrying}
          >
            {retrying ? '正在重试…' : '重试'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            data-testid="no-store-choose"
            onClick={onChoose}
          >
            选择其他目录
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="no-store-exit"
            onClick={onExit}
          >
            退出
          </button>
        </div>
      </div>
    </div>
  )
}
