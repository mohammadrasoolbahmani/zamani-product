import {
  LuBeef,
  LuCalendarDays,
  LuCalendarRange,
  LuCheck,
  LuListFilter,
} from 'react-icons/lu'
import JalaliDateInput from './JalaliDateInput'
import { daysBetweenISO, formatJalaliRange } from '../utils/date'
import { faDigits } from '../utils/format'

const PERIODS = [
  { key: 'daily', label: 'روزانه' },
  { key: 'weekly', label: 'هفتگی' },
  { key: 'monthly', label: 'ماهانه' },
  { key: 'yearly', label: 'سالانه' },
]

const PRODUCT_TYPES = [
  { key: '', label: 'همه محصولات' },
  { key: '60', label: '۶۰ درصد' },
  { key: '90', label: '۹۰ درصد' },
]

export default function PeriodFilter({
  mode,
  range,
  customOpen,
  draft,
  error,
  productType = '',
  onSelectPreset,
  onOpenCustom,
  onDraftChange,
  onApplyCustom,
  onSelectProductType,
  disabled = false,
}) {
  const days = range ? daysBetweenISO(range.start, range.end) : 0
  const customActive = customOpen || mode === 'custom'

  return (
    <section className="panel mb-4 p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <span className="icon-box h-10 w-10 border border-meat-red/25 bg-meat-red/10 text-meat-red">
            <LuListFilter className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-[13px] font-bold text-white">فیلتر زمان و محصول</h2>
            <p className="mt-0.5 text-[10px] text-white/35">
              آمار روزانه، هفتگی، ماهانه، سالانه یا بازه دلخواه، برای ۶۰ یا ۹۰ درصد
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 xl:items-end">
          <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.07] bg-[#141414] p-1">
            {PERIODS.map((period) => (
              <button
                key={period.key}
                type="button"
                onClick={() => onSelectPreset(period.key)}
                disabled={disabled}
                className={`rounded-lg px-3.5 py-2 text-[11px] font-semibold transition ${
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
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                customActive
                  ? 'bg-red-sheen text-white shadow-red-glow'
                  : 'text-white/45 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <LuCalendarRange className="size-3.5" />
              بازه دلخواه
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] text-white/35">
              <LuBeef className="size-3.5 text-white/25" />
              نوع محصول
            </span>
            <div className="flex gap-1 rounded-xl border border-white/[0.07] bg-[#141414] p-1">
              {PRODUCT_TYPES.map((type) => (
                <button
                  key={type.key || 'all'}
                  type="button"
                  onClick={() => onSelectProductType?.(type.key)}
                  disabled={disabled || !onSelectProductType}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${
                    (productType || '') === type.key
                      ? 'bg-sky-600/85 text-white shadow-[0_4px_14px_rgba(2,132,199,0.35)]'
                      : 'text-white/45 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {customOpen && (
        <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] xl:items-end">
          <div>
            <label htmlFor="dashboard-start" className="field-label">
              از تاریخ
            </label>
            <JalaliDateInput
              id="dashboard-start"
              value={draft.start}
              onChange={(value) => onDraftChange('start', value)}
            />
          </div>
          <div>
            <label htmlFor="dashboard-end" className="field-label">
              تا تاریخ
            </label>
            <JalaliDateInput
              id="dashboard-end"
              value={draft.end}
              onChange={(value) => onDraftChange('end', value)}
            />
          </div>
          <button type="button" onClick={onApplyCustom} className="btn-primary">
            <LuCheck className="size-4" />
            اعمال بازه
          </button>
          {error && (
            <p className="text-[10px] text-red-300 sm:col-span-2 xl:col-span-3">{error}</p>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-white/35">
        <LuCalendarDays className="size-3.5 text-white/25" />
        <span>بازه انتخابی:</span>
        <span className="font-medium text-white/65">
          {range ? formatJalaliRange(range.start, range.end) : '—'}
        </span>
        <span className="text-white/20">•</span>
        <span>{faDigits(days)} روز</span>
        <span className="text-white/20">•</span>
        <span className="chip border-sky-400/20 bg-sky-400/10 text-sky-200">
          {productType === '60'
            ? 'محصولات ۶۰ درصد'
            : productType === '90'
              ? 'محصولات ۹۰ درصد'
              : 'همه محصولات'}
        </span>
        {mode === 'custom' && !customOpen && (
          <span className="chip border-meat-red/20 bg-meat-red/10 text-red-200">
            بازه دلخواه
          </span>
        )}
      </div>
    </section>
  )
}
