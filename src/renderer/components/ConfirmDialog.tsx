import { useEffect, useId, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  /** `null` hides the cancel button (message-only dialog). */
  cancelLabel?: string | null
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * In-app confirmation modal. Deliberately never uses `window.confirm`/
 * `window.alert`: Electron's native JavaScript dialogs leave the renderer's
 * focus state desynced, so the next focused input (e.g. the inline list form)
 * cannot be typed into (electron/electron#40212, #20821, #51760).
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const titleId = useId()
  const messageId = useId()

  // Callers pass inline handlers; keep the effect mount-only by reading the
  // latest one through a ref.
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  // Focus the safe action (cancel) on open, trap Tab, close on Escape and
  // restore focus to the trigger when closed.
  useEffect(() => {
    triggerRef.current = document.activeElement

    const timer = requestAnimationFrame(() => {
      const modal = modalRef.current
      if (!modal) return
      const cancelButton = modal.querySelector<HTMLElement>(
        '[data-testid="confirm-dialog-cancel"]',
      )
      ;(cancelButton ?? modal.querySelector<HTMLElement>('button'))?.focus()
    })

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancelRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const modal = modalRef.current
      if (!modal) return
      const buttons = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled])',
      )
      if (buttons.length === 0) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      cancelAnimationFrame(timer)
      document.removeEventListener('keydown', handleKeyDown)
      const trigger = triggerRef.current
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        requestAnimationFrame(() => trigger.focus())
      }
    }
  }, [])

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      data-testid="confirm-dialog-overlay"
    >
      <div
        className="modal-content confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        ref={modalRef}
        data-testid="confirm-dialog"
      >
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
        </div>
        <div className="modal-body">
          <p
            className="confirm-dialog-message"
            id={messageId}
            data-testid="confirm-dialog-message"
          >
            {message}
          </p>
          <div className="form-actions">
            {cancelLabel !== null && (
              <button
                className="btn btn-secondary"
                type="button"
                onClick={onCancel}
                data-testid="confirm-dialog-cancel"
              >
                {cancelLabel}
              </button>
            )}
            <button
              className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
              type="button"
              onClick={onConfirm}
              data-testid="confirm-dialog-confirm"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
