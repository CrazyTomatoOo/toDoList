import type { Recurrence } from '../../shared/ipc'

interface RecurrenceFieldsProps {
  recurrence: Recurrence | ''
  recurrenceEndDate: string
  disabled: boolean
  onRecurrenceChange: (value: Recurrence | '') => void
  onRecurrenceEndDateChange: (value: string) => void
}

const RECURRENCE_OPTIONS: { value: Recurrence | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' }
]

export default function RecurrenceFields({
  recurrence,
  recurrenceEndDate,
  disabled,
  onRecurrenceChange,
  onRecurrenceEndDateChange
}: RecurrenceFieldsProps) {
  return (
    <div className="form-row">
      <div className="form-group">
        <label className="form-label" htmlFor="task-recurrence">
          Recurrence
        </label>
        <select
          id="task-recurrence"
          className="form-input"
          value={recurrence}
          onChange={(e) => onRecurrenceChange(e.target.value as Recurrence | '')}
          disabled={disabled}
          data-testid="task-form-recurrence"
        >
          {RECURRENCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {recurrence && (
        <div className="form-group">
          <label className="form-label" htmlFor="task-recurrence-end-date">
            Recurrence End Date
          </label>
          <input
            id="task-recurrence-end-date"
            className="form-input"
            type="date"
            value={recurrenceEndDate}
            onChange={(e) => onRecurrenceEndDateChange(e.target.value)}
            disabled={disabled}
            data-testid="task-form-recurrence-end-date"
          />
        </div>
      )}
    </div>
  )
}
