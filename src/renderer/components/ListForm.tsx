import { useState, type FormEvent } from 'react'

interface ListFormProps {
  onSubmit: (name: string) => Promise<void>
  onCancel: () => void
  initialName?: string
  existingNames?: string[]
}

export default function ListForm({
  onSubmit,
  onCancel,
  initialName = '',
  existingNames = []
}: ListFormProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()

    if (!trimmed) {
      setError('请输入列表名称')
      return
    }

    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== initialName)) {
      setError('已存在同名列表')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存列表失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="list-form" onSubmit={handleSubmit} data-testid="list-form">
      <input
        className="list-form-input form-input"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
        placeholder="列表名称"
        autoFocus
        disabled={submitting}
        data-testid="list-form-input"
        maxLength={100}
      />
      {error && (
        <div className="form-error" role="alert" aria-live="polite" data-testid="list-form-error">
          {error}
        </div>
      )}
      <div className="list-form-actions">
        <button
          className="btn btn-primary btn-sm"
          type="submit"
          disabled={submitting}
          data-testid="list-form-save"
        >
          {submitting ? '保存中…' : '保存'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={onCancel}
          disabled={submitting}
          data-testid="list-form-cancel"
        >
          取消
        </button>
      </div>
    </form>
  )
}
