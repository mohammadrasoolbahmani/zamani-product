import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import { faDigits, formatNumber } from '../utils/format'

export default function Pagination({ page, totalPages, count, pageSize, onPageChange, itemLabel = 'مورد' }) {
  if (!count) return null
  const safeTotal = Math.max(totalPages || 1, 1)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, count)

  const pages = []
  const start = Math.max(1, Math.min(page - 1, safeTotal - 2))
  const end = Math.min(safeTotal, Math.max(page + 1, 3))
  for (let index = start; index <= end; index += 1) pages.push(index)

  return (
    <div className="flex flex-col items-center justify-between gap-3 px-5 py-4 sm:flex-row">
      <p className="text-[11px] text-white/40">
        نمایش {faDigits(from)} تا {faDigits(to)} از {formatNumber(count)} {itemLabel}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="btn-ghost h-8 w-8 !px-0"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="صفحه قبلی"
        >
          <LuChevronRight className="size-4" />
        </button>
        {pages.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? 'page' : undefined}
            className={`h-8 min-w-8 rounded-lg px-2 text-[12px] font-semibold transition ${
              item === page
                ? 'bg-meat-red text-white shadow-red-glow'
                : 'text-white/50 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {faDigits(item)}
          </button>
        ))}
        <button
          type="button"
          className="btn-ghost h-8 w-8 !px-0"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= safeTotal}
          aria-label="صفحه بعدی"
        >
          <LuChevronLeft className="size-4" />
        </button>
      </div>
    </div>
  )
}
