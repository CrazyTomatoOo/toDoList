import DatePicker from './DatePicker'

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
  error,
}: DurationFieldsProps) {
  return (
    <div className="form-group">
      <div className="form-row">
        <div className="form-group">
          <label className="form-label" htmlFor="task-start-date">
            开始日期
          </label>
          <DatePicker
            value={startDate || null}
            onChange={onStartDateChange}
            disabled={disabled}
            id="task-start-date"
            testid="task-form-start-date"
            placeholder="年/月/日"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="task-end-date">
            结束日期
          </label>
          <DatePicker
            value={endDate || null}
            onChange={onEndDateChange}
            disabled={disabled}
            id="task-end-date"
            testid="task-form-end-date"
            placeholder="年/月/日"
          />
        </div>
      </div>
      {error && (
        <div
          className="form-error"
          role="alert"
          aria-live="polite"
          data-testid="task-form-duration-error"
        >
          {error}
        </div>
      )}
    </div>
  )
}
