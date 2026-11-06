import { LuCalendarDays, LuCalendarRange, LuCheck, LuListFilter } from 'react-icons/lu'
import JalaliDateInput from './JalaliDateInput'
import { daysBetweenISO, formatJalaliRange } from '../utils/date'
import { faDigits } from '../utils/format'

const PERIODS = [
  { key: 'all', label: 'همه' },
  { key: 'daily', label: 'روزانه' },
  { key: 'weekly', label: 'هفتگی' },
  { key: 'monthly', label: 'ماهانه' },
  { key: 'yearly', label: 'سالانه' },
]

export default function PeriodBar({
  mode = 'all',
  range = { start: '', end: '' },
  customOpen = false,
  draft = { start: '', end: '' },
  error = '',
  onSelectPreset,
  onOpenCustom,
  onDraftChange,
  onApplyCustom,
  disabled = false,
}) {
  const hasRange = Boolean(range?.start || range?.end)
  const days = hasRange ? daysBetweenISO(range.start, range.end) : 0
  const customActive = customOpen || mode === 'custom'

  return (
    <div className="border-b border-white/[0.055] px-5 py-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="icon-box size-8 border border-white/10 bg-white/[0.03] text-white/45">
            <LuListFilter className="size-3.5" />
          </span>
          <div>
            <p className="text-[12px] font-medium text-white/70">بازه زمانی نمایش</p>
            <p className="mt-0.5 text-[10px] text-white/30">
              سوابق را بر اساس روز، هفته، ماه، سال یا بازه دلخواه ببینید.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.07] bg-[#141414] p-1">
          {PERIODS.map((period) => (
            <button
              key={period.key}
              type="button"
              onClick={() => onSelectPreset?.(period.key)}
              disabled={disabled}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                mode === period.key && !customOpen
                  ? 'bg-red-sheen text-white shadow-red-glow'
                  : 'text-white/45 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {period.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onOpenCustom}
            disabled={disabled}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
              customActive
                ? 'bg-red-sheen text-white shadow-red-glow'
                : 'text-white/45 hover:bg-white/[0.05] hover:text-white'
            }`}
          >
            <LuCalendarRange className="size-3.5" />
            بازه دلخواه
          </button>
        </div>
      </div>

      {customOpen && (
        <div className="mt-3 grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <div>
            <label htmlFor="list-start" className="field-label">
              از تاریخ
            </label>
            <JalaliDateInput
              id="list-start"
              value={draft.start}
              onChange={(value) => onDraftChange?.('start', value)}
            />
          </div>
          <div>
            <label htmlFor="list-end" className="field-label">
              تا تاریخ
            </label>
            <JalaliDateInput
              id="list-end"
              value={draft.end}
              onChange={(value) => onDraftChange?.('end', value)}
            />
          </div>
          <button type="button" onClick={onApplyCustom} className="btn-primary">
            <LuCheck className="size-4" />
            اعمال بازه
          </button>
          {error && (
            <p className="text-[10px] text-red-300 sm:col-span-2 lg:col-span-3">{error}</p>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-white/30">
        <LuCalendarDays className="size-3.5 text-white/20" />
        <span>بازه انتخابی:</span>
        <span className="font-medium text-white/60">
          {hasRange ? formatJalaliRange(range.start, range.end) : 'همه سوابق'}
        </span>
        {hasRange && (
          <>
            <span className="text-white/15">•</span>
            <span>{faDigits(days)} روز</span>
          </>
        )}
      </div>
    </div>
  )
}
