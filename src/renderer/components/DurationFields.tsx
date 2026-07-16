interface DurationFieldsProps {
  startDate: string
  endDate: string
  disabled: boolean
  onStartDateChange: (value: string) => void
  onEndDateChange: (value: string) => void
  error?: string | null
}

export default function DurationFields({
  startDate,
  endDate,
  disabled,
  onStartDateChange,
  onEndDateChange,
  error
}: DurationFieldsProps) {
  return (
    <div className="form-group">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="task-start-date">
            Start Date
          </label>
          <input
            id="task-start-date"
            className="form-input"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            disabled={disabled}
            data-testid="task-form-start-date"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="task-end-date">
            End Date
          </label>
          <input
            id="task-end-date"
            className="form-input"
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            disabled={disabled}
            data-testid="task-form-end-date"
          />
        </div>
      </div>
      {error && (
        <div className="form-error" role="alert" aria-live="polite" data-testid="task-form-duration-error">
          {error}
        </div>
      )}
    </div>
  )
}
