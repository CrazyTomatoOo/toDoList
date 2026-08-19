import type { Recurrence } from '../../shared/ipc'
import DatePicker from './DatePicker'

interface RecurrenceFieldsProps {
  recurrence: Recurrence | ''
  recurrenceEndDate: string
  disabled: boolean
  onRecurrenceChange: (value: Recurrence | '') => void
  onRecurrenceEndDateChange: (value: string) => void
}

const RECURRENCE_OPTIONS: { value: Recurrence | ''; label: string }[] = [
  { value: '', label: '不重复' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'yearly', label: '每年' },
]

export default function RecurrenceFields({
  recurrence,
  recurrenceEndDate,
  disabled,
  onRecurrenceChange,
  onRecurrenceEndDateChange,
}: RecurrenceFieldsProps) {
  return (
    <div className="form-row">
      <div className="form-group">
        <label className="form-label" htmlFor="task-recurrence">
          重复
        </label>
        <select
          id="task-recurrence"
          className="form-input"
          value={recurrence}
          onChange={(e) =>
            onRecurrenceChange(e.target.value as Recurrence | '')
          }
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
            重复结束日期
          </label>
          <DatePicker
            value={recurrenceEndDate || null}
            onChange={onRecurrenceEndDateChange}
            disabled={disabled}
            id="task-recurrence-end-date"
            testid="task-form-recurrence-end-date"
            placeholder="年/月/日"
          />
        </div>
      )}
    </div>
  )
}
