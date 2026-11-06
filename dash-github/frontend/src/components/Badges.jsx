export function StatusBadge({ active, activeLabel = 'فعال', inactiveLabel = 'غیرفعال' }) {
  return (
    <span
      className={`chip ${
        active
          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
          : 'border-white/10 bg-white/[0.04] text-white/40'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-white/30'}`} />
      {active ? activeLabel : inactiveLabel}
    </span>
  )
}
