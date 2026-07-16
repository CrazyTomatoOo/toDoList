interface QuadrantFlagsProps {
  isUrgent: boolean
  isImportant: boolean
  disabled: boolean
  onUrgentChange: (value: boolean) => void
  onImportantChange: (value: boolean) => void
}

export default function QuadrantFlags({
  isUrgent,
  isImportant,
  disabled,
  onUrgentChange,
  onImportantChange
}: QuadrantFlagsProps) {
  return (
    <div className="form-group">
      <label className="form-label">Quadrant</label>
      <div className="form-checkbox-group">
        <label className="form-checkbox-label" data-testid="task-form-urgent-label">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={isUrgent}
            onChange={(e) => onUrgentChange(e.target.checked)}
            disabled={disabled}
            data-testid="task-form-urgent"
          />
          <span>Urgent</span>
        </label>
        <label className="form-checkbox-label" data-testid="task-form-important-label">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={isImportant}
            onChange={(e) => onImportantChange(e.target.checked)}
            disabled={disabled}
            data-testid="task-form-important"
          />
          <span>Important</span>
        </label>
      </div>
    </div>
  )
}
