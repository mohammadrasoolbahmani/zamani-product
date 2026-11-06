import { useEffect, useState } from 'react'
import { LuCalendarDays } from 'react-icons/lu'
import {
  isoToJalaliInput,
  jalaliInputToISO,
  todayISO,
} from '../utils/date'

export default function JalaliDateInput({
  id,
  value,
  onChange,
  error,
  disabled = false,
  className = '',
  placeholder,
}) {
  const [text, setText] = useState(value ? isoToJalaliInput(value) : '')
  const [internalError, setInternalError] = useState('')

  useEffect(() => {
    if (value) {
      setText(isoToJalaliInput(value))
      setInternalError('')
    }
  }, [value])

  const handleChange = (event) => {
    const next = event.target.value
    setText(next)
    setInternalError('')
    const iso = jalaliInputToISO(next)
    onChange?.(iso)
  }

  const handleBlur = () => {
    if (!text.trim()) {
      setInternalError('تاریخ را وارد کنید.')
      return
    }
    const iso = jalaliInputToISO(text)
    if (!iso) {
      setInternalError('تاریخ شمسی معتبر نیست؛ نمونه: ۱۴۰۵/۰۸/۱۱')
      return
    }
    setInternalError('')
    setText(isoToJalaliInput(iso))
    onChange?.(iso)
  }

  const pickToday = () => {
    const iso = todayISO()
    onChange?.(iso)
    setText(isoToJalaliInput(iso))
    setInternalError('')
  }

  const message = internalError || error

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={text}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder || isoToJalaliInput(todayISO())}
          className={`input pl-11 text-right tracking-wide ${message ? 'input-error' : ''}`}
          aria-invalid={Boolean(message)}
          aria-describedby={message ? `${id}-error` : undefined}
        />
        <button
          type="button"
          onClick={pickToday}
          disabled={disabled}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-white/35 transition hover:bg-white/[0.06] hover:text-white/75 disabled:opacity-40"
          aria-label="انتخاب تاریخ امروز"
          title="امروز"
        >
          <LuCalendarDays className="size-[17px]" />
        </button>
      </div>
      {message && (
        <p id={`${id}-error`} className="mt-1.5 text-[10px] text-red-300">
          {message}
        </p>
      )}
    </div>
  )
}
