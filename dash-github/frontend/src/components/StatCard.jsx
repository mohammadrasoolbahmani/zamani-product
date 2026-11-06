import { LuTrendingDown, LuTrendingUp } from 'react-icons/lu'
import { formatPercent } from '../utils/format'

const TONES = {
  green: {
    card: 'border-emerald-500/20 bg-[linear-gradient(135deg,rgba(46,125,50,0.22),rgba(30,30,30,0.94)_58%)] hover:border-emerald-400/35',
    icon: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20',
    bars: 'bg-emerald-400/65',
    glow: 'bg-emerald-500/15',
    accent: 'text-emerald-300',
  },
  blue: {
    card: 'border-sky-500/20 bg-[linear-gradient(135deg,rgba(25,118,210,0.24),rgba(30,30,30,0.94)_58%)] hover:border-sky-400/35',
    icon: 'bg-sky-500/15 text-sky-300 ring-sky-400/20',
    bars: 'bg-sky-400/65',
    glow: 'bg-sky-500/15',
    accent: 'text-sky-300',
  },
  orange: {
    card: 'border-orange-500/20 bg-[linear-gradient(135deg,rgba(237,108,2,0.22),rgba(30,30,30,0.94)_58%)] hover:border-orange-400/35',
    icon: 'bg-orange-500/15 text-orange-300 ring-orange-400/20',
    bars: 'bg-orange-400/65',
    glow: 'bg-orange-500/15',
    accent: 'text-orange-300',
  },
  purple: {
    card: 'border-purple-500/20 bg-[linear-gradient(135deg,rgba(123,31,162,0.25),rgba(30,30,30,0.94)_58%)] hover:border-purple-400/35',
    icon: 'bg-purple-500/15 text-purple-300 ring-purple-400/20',
    bars: 'bg-purple-400/65',
    glow: 'bg-purple-500/15',
    accent: 'text-purple-300',
  },
}

const BARS = [38, 58, 45, 76, 52, 88, 67]

export default function StatCard({
  title,
  value,
  unit,
  change,
  icon: Icon,
  tone = 'green',
  loading = false,
  delayClass = '',
  comparisonLabel = 'نسبت به دوره قبل',
  invertTrend = false,
}) {
  const styles = TONES[tone] ?? TONES.green
  const numericChange = Number(change)
  const hasChange = change !== null && change !== undefined && Number.isFinite(numericChange)
  const isPositive = numericChange > 0
  const isImprovement = invertTrend ? numericChange < 0 : numericChange > 0
  const isDecline = invertTrend ? numericChange > 0 : numericChange < 0
  const TrendIcon = isPositive ? LuTrendingUp : LuTrendingDown

  if (loading) {
    return (
      <div className="panel h-[174px] p-5">
        <div className="flex items-center justify-between">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="skeleton h-3.5 w-24" />
        </div>
        <div className="skeleton mt-6 h-7 w-32" />
        <div className="skeleton mt-5 h-3 w-full" />
      </div>
    )
  }

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border p-4 shadow-panel transition duration-300 hover:-translate-y-0.5 sm:p-5 ${styles.card} ${delayClass}`}
    >
      <div
        className={`pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full blur-3xl ${styles.glow}`}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-2">
        <span className={`icon-box h-9 w-9 ring-1 sm:h-10 sm:w-10 ${styles.icon}`}>
          {Icon && <Icon className="size-[18px] sm:size-[20px]" />}
        </span>
        <h3 className="pt-1 text-right text-[11px] font-medium leading-5 text-white/65 sm:text-[13px]">
          {title}
        </h3>
      </div>

      <div className="relative mt-3 flex items-end justify-between gap-2 sm:mt-4 sm:gap-3">
        <div className="min-w-0">
          <p className="truncate text-[22px] font-extrabold leading-none tracking-tight text-white sm:text-[27px]">
            {value}
          </p>
          <p className="mt-1.5 text-[9.5px] text-white/40 sm:text-[11px]">{unit}</p>
        </div>
        <div className="flex h-8 items-end gap-[2px] pb-0.5 opacity-80 sm:h-9 sm:gap-[3px]" aria-hidden="true">
          {BARS.map((height, index) => (
            <span
              key={index}
              className={`w-[4px] rounded-t-sm sm:w-[5px] ${styles.bars}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1 border-t border-white/[0.08] pt-2.5 sm:mt-4 sm:gap-1.5 sm:pt-3">
        {hasChange ? (
          <>
            <TrendIcon
              className={`size-3.5 ${
                isImprovement ? 'text-emerald-300' : isDecline ? 'text-red-300' : 'text-white/35'
              }`}
            />
            <span
              className={`text-[10px] font-semibold sm:text-[11px] ${
                isImprovement ? 'text-emerald-300' : isDecline ? 'text-red-300' : 'text-white/45'
              }`}
            >
              {Math.abs(numericChange) < 0.05 ? 'بدون تغییر' : formatPercent(Math.abs(numericChange))}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-white/35 sm:text-[11px]">—</span>
        )}
        <span className="text-[9px] text-white/35 sm:text-[10px]">{comparisonLabel}</span>
      </div>
    </article>
  )
}
