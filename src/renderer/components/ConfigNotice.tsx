import { AlertTriangle } from 'lucide-react'
import type { DataDirProblem } from '../../shared/ipc'

interface ConfigNoticeProps {
  problem: DataDirProblem
  configPath: string
  onOpenSettings: () => void
  onAcknowledge: () => void
}

/**
 * 常驻「配置未生效」提示条 (issue #14).
 *
 * Rendered between the header and the content while the bootstrap config is
 * broken and unacknowledged. role="status" (not "alert") so screen readers
 * announce it politely without stealing focus at startup; nothing here is
 * focused on mount. The one-line reason is followed by the exact config path
 * in monospace — the settings page's data tab carries the full story
 * (「文件未被修改」「本次运行期间显示的是默认目录中的数据」), per ADR-0005's
 * wording split.
 */
export default function ConfigNotice({
  problem,
  configPath,
  onOpenSettings,
  onAcknowledge,
}: ConfigNoticeProps) {
  return (
    <div
      className="config-notice"
      role="status"
      data-testid="config-notice"
      aria-label="配置未生效"
    >
      <AlertTriangle size={16} className="config-notice-icon" />
      <span className="config-notice-reason" data-testid="config-notice-reason">
        {problem.detail.split('：')[0]}，本次运行使用默认数据目录：
      </span>
      <code className="config-notice-path" data-testid="config-notice-path">
        {configPath}
      </code>
      <div className="config-notice-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onOpenSettings}
        >
          打开设置
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAcknowledge}
        >
          知道了
        </button>
      </div>
    </div>
  )
}
