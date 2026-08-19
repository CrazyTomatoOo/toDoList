/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DatePicker from '../../renderer/components/DatePicker'

describe('DatePicker', () => {
  it('renders hidden native input carrying the value', () => {
    render(<DatePicker value="2026-08-19" onChange={vi.fn()} testid="dp" />)
    const native = screen.getByTestId('dp') as HTMLInputElement
    expect(native).toHaveAttribute('type', 'date')
    expect(native).toHaveValue('2026-08-19')
    expect(screen.getByText('8月19日')).toBeInTheDocument()
  })

  it('shows the placeholder when empty', () => {
    render(
      <DatePicker
        value={null}
        onChange={vi.fn()}
        testid="dp"
        placeholder="年/月/日"
      />,
    )
    expect(screen.getByText('年/月/日')).toBeInTheDocument()
  })

  it('opens the popup on trigger click and closes on Escape without bubbling to the form', () => {
    const containerKeyDown = vi.fn()
    render(
      <div onKeyDown={containerKeyDown}>
        <DatePicker value="2026-08-19" onChange={vi.fn()} testid="dp" />
      </div>,
    )
    fireEvent.click(screen.getByTestId('dp-trigger'))
    const popup = screen.getByRole('dialog', { name: '选择日期' })
    expect(popup).toBeInTheDocument()
    expect(screen.getByText('2026年8月')).toBeInTheDocument()
    fireEvent.keyDown(popup, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // capture-phase handler must stop the event before the form-level handler sees it
    expect(containerKeyDown).not.toHaveBeenCalled()
  })

  it('selects a day and reports YYYY-MM-DD then closes', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-08-19" onChange={onChange} testid="dp" />)
    fireEvent.click(screen.getByTestId('dp-trigger'))
    fireEvent.click(screen.getByTestId('dp-day-2026-08-21'))
    expect(onChange).toHaveBeenCalledWith('2026-08-21')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('selects a day from the previous month via navigation', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-08-19" onChange={onChange} testid="dp" />)
    fireEvent.click(screen.getByTestId('dp-trigger'))
    fireEvent.click(screen.getByRole('button', { name: '上个月' }))
    expect(screen.getByText('2026年7月')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('dp-day-2026-07-01'))
    expect(onChange).toHaveBeenCalledWith('2026-07-01')
  })

  it('clears via the footer action', () => {
    const onChange = vi.fn()
    render(<DatePicker value="2026-08-19" onChange={onChange} testid="dp" />)
    fireEvent.click(screen.getByTestId('dp-trigger'))
    fireEvent.click(screen.getByTestId('dp-clear'))
    expect(onChange).toHaveBeenCalledWith('')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('applies today via the footer action', () => {
    const onChange = vi.fn()
    render(<DatePicker value={null} onChange={onChange} testid="dp" />)
    fireEvent.click(screen.getByTestId('dp-trigger'))
    fireEvent.click(screen.getByTestId('dp-today'))
    const now = new Date()
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    expect(onChange).toHaveBeenCalledWith(iso)
  })

  it('closes on outside click', () => {
    render(
      <div>
        <DatePicker value="2026-08-19" onChange={vi.fn()} testid="dp" />
      </div>,
    )
    fireEvent.click(screen.getByTestId('dp-trigger'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('disables the trigger when disabled', () => {
    render(<DatePicker value={null} onChange={vi.fn()} testid="dp" disabled />)
    const trigger = screen.getByTestId('dp-trigger') as HTMLButtonElement
    expect(trigger).toBeDisabled()
  })

  it('highlights today and selected distinct classes', () => {
    render(<DatePicker value="2026-08-19" onChange={vi.fn()} testid="dp" />)
    fireEvent.click(screen.getByTestId('dp-trigger'))
    expect(screen.getByTestId('dp-day-2026-08-19')).toHaveClass('selected')
    const now = new Date()
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const todayBtn = screen.queryByTestId(`dp-day-${todayIso}`)
    if (todayBtn) expect(todayBtn).toHaveClass('today')
  })
})
