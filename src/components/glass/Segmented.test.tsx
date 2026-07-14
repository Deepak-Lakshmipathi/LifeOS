/**
 * S21 — Segmented (DESIGN_LANGUAGE §4.1).
 * role="tablist" a11y, click switches .on, real <button>s throughout.
 */
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Segmented } from './Segmented'

const OPTIONS = [
  { id: 'morning', label: 'Morning' },
  { id: 'midday', label: 'Midday' },
  { id: 'evening', label: 'Evening' },
]

describe('Segmented', () => {
  it('renders role="tablist" with a role="tab" real <button> per option', () => {
    render(<Segmented options={OPTIONS} value="morning" onChange={() => {}} ariaLabel="Time of day" />)

    const tablist = screen.getByRole('tablist', { name: 'Time of day' })
    expect(tablist).toBeInTheDocument()

    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    tabs.forEach((tab) => expect(tab.tagName).toBe('BUTTON'))
  })

  it('marks the active option with aria-selected and the .on class', () => {
    render(<Segmented options={OPTIONS} value="midday" onChange={() => {}} />)

    const active = screen.getByRole('tab', { name: 'Midday' })
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(active.className.split(' ')).toContain('on')

    const inactive = screen.getByRole('tab', { name: 'Morning' })
    expect(inactive).toHaveAttribute('aria-selected', 'false')
    expect(inactive.className.split(' ')).not.toContain('on')
  })

  it('calls onChange with the clicked option id', () => {
    const onChange = vi.fn()
    render(<Segmented options={OPTIONS} value="morning" onChange={onChange} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Evening' }))

    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('evening')
  })

  it('switches which button carries .on when the controlled value changes', () => {
    const { rerender } = render(<Segmented options={OPTIONS} value="morning" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Morning' }).className.split(' ')).toContain('on')

    rerender(<Segmented options={OPTIONS} value="evening" onChange={() => {}} />)

    expect(screen.getByRole('tab', { name: 'Evening' }).className.split(' ')).toContain('on')
    expect(screen.getByRole('tab', { name: 'Morning' }).className.split(' ')).not.toContain('on')
  })
})
