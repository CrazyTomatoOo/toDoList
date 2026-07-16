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
      setError('List name is required')
      return
    }

    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase() && n !== initialName)) {
      setError('A list with this name already exists')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save list')
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
        placeholder="List name"
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
          {submitting ? 'Saving...' : 'Save'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          type="button"
          onClick={onCancel}
          disabled={submitting}
          data-testid="list-form-cancel"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
