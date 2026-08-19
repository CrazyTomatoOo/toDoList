import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatChineseDate } from './TaskItem'

interface DatePickerProps {
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  testid?: string
  placeholder?: string
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** Days in month grid: padded to full weeks (0 = Sunday). [year, month(1-12), day][] */
function buildMonthGrid(
  year: number,
  month: number,
): Array<[number, number, number]> {
  const first = new Date(year, month - 1, 1)
  const startPad = first.getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const grid: Array<[number, number, number]> = []
  const prevMonthDays = new Date(year, month - 1, 0).getDate()

  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevMonthDays - i
    const m = month === 1 ? 12 : month - 1
    const y = month === 1 ? year - 1 : year
    grid.push([y, m, day])
  }
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push([year, month, d])
  }
  const total = grid.length
  for (let d = 1; d <= 42 - total; d++) {
    const m = month === 12 ? 1 : month + 1
    const y = month === 12 ? year + 1 : year
    grid.push([y, m, d])
  }
  return grid
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Custom day-picker replacing the native date input popup (which renders light-only in Electron). */
export default function DatePicker({
  value,
  onChange,
  disabled = false,
  id,
  testid,
  placeholder = '选择日期',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const now = new Date()
  const [viewYear, setViewYear] = useState(() => {
    const parsed = value ? parseValue(value) : null
    return parsed ? parsed.year : now.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const parsed = value ? parseValue(value) : null
    return parsed ? parsed.month : now.getMonth() + 1
  })
  const wrapRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!open) return

    const position = () => {
      const trigger = wrapRef.current?.querySelector<HTMLElement>(
        '.date-picker-trigger',
      )
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const popupHeight = 320
      const popupWidth = 280
      const top =
        rect.bottom + 4 + popupHeight > window.innerHeight
          ? Math.max(8, rect.top - 4 - popupHeight)
          : rect.bottom + 4
      const left = Math.min(
        rect.left,
        Math.max(8, window.innerWidth - popupWidth - 8),
      )
      setPos({ top, left })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [open])

  // close on Escape, capture-phase so the form's bubble-phase global handler
  // (which closes the whole modal) never sees the key
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      setOpen(false)
      wrapRef.current
        ?.querySelector<HTMLElement>('.date-picker-trigger')
        ?.focus()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open])

  // close on outside click
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (wrapRef.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const openPicker = useCallback(() => {
    if (disabled) return
    setOpen(true)
  }, [disabled])

  const select = useCallback(
    (year: number, month: number, day: number) => {
      onChange(toISO(year, month, day))
      setOpen(false)
    },
    [onChange],
  )

  const selected = value ? parseValue(value) : null
  const grid = buildMonthGrid(viewYear, viewMonth)
  const today = toISO(now.getFullYear(), now.getMonth() + 1, now.getDate())

  const popup =
    open && pos ? (
      <div
        ref={popupRef}
        className="date-picker-popup"
        data-testid={`${testid ?? 'date-picker'}-popup`}
        role="dialog"
        aria-label="选择日期"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="date-picker-header">
          <button
            type="button"
            className="date-picker-nav"
            aria-label="上个月"
            onClick={() => {
              setViewMonth((m) => (m === 1 ? 12 : m - 1))
              setViewYear((y) => (viewMonth === 1 ? y - 1 : y))
            }}
          >
            ‹
          </button>
          <div
            className="date-picker-title"
            data-testid={`${testid ?? 'date-picker'}-title`}
          >
            {viewYear}年{viewMonth}月
          </div>
          <button
            type="button"
            className="date-picker-nav"
            aria-label="下个月"
            onClick={() => {
              setViewMonth((m) => (m === 12 ? 1 : m + 1))
              setViewYear((y) => (viewMonth === 12 ? y + 1 : y))
            }}
          >
            ›
          </button>
        </div>
        <div className="date-picker-weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w} className="date-picker-weekday">
              {w}
            </span>
          ))}
        </div>
        <div className="date-picker-grid" role="grid" aria-label="日期">
          {grid.map(([y, m, d]) => {
            const iso = toISO(y, m, d)
            const inMonth = m === viewMonth
            const isSelected =
              selected &&
              selected.year === y &&
              selected.month === m &&
              selected.day === d
            const isToday = iso === today
            return (
              <button
                key={iso}
                type="button"
                className={`date-picker-day${inMonth ? '' : ' out'}${
                  isSelected ? ' selected' : ''
                }${isToday ? ' today' : ''}`}
                aria-label={`${y}年${m}月${d}日`}
                data-testid={`${testid ?? 'date-picker'}-day-${iso}`}
                onClick={() => select(y, m, d)}
              >
                {d}
              </button>
            )
          })}
        </div>
        <div className="date-picker-footer">
          <button
            type="button"
            className="date-picker-action"
            data-testid={`${testid ?? 'date-picker'}-clear`}
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            清除
          </button>
          <button
            type="button"
            className="date-picker-action"
            data-testid={`${testid ?? 'date-picker'}-today`}
            onClick={() => {
              const t = now
              setViewYear(t.getFullYear())
              setViewMonth(t.getMonth() + 1)
              select(t.getFullYear(), t.getMonth() + 1, t.getDate())
            }}
          >
            今天
          </button>
        </div>
      </div>
    ) : null

  return (
    <div className="date-picker" ref={wrapRef}>
      {/* Hidden native input: keeps value semantics, form-submission and the
          e2e `fill()` pathway working; never rendered visibly. */}
      <input
        type="date"
        className="date-picker-native"
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        data-testid={testid}
      />
      <button
        type="button"
        className="date-picker-trigger"
        data-testid={testid ? `${testid}-trigger` : undefined}
        onClick={openPicker}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? '' : 'placeholder'}>
          {value ? formatChineseDate(value) : placeholder}
        </span>
      </button>
      {createPortal(popup, document.body)}
    </div>
  )
}

interface ParsedDate {
  year: number
  month: number
  day: number
}

function parseValue(value: string): ParsedDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}
