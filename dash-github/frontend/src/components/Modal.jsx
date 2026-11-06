import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { LuX } from 'react-icons/lu'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  size = 'md',
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-label="بستن پنجره"
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-[#1c1c1c] shadow-2xl animate-fade-up sm:mx-4 sm:rounded-2xl ${SIZES[size]}`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-[#1c1c1c]/95 px-5 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {Icon && (
              <span className="icon-box h-10 w-10 border border-meat-red/25 bg-meat-red/10 text-meat-red">
                <Icon className="size-5" />
              </span>
            )}
            <div>
              <h2 id={titleId} className="text-base font-bold text-white">
                {title}
              </h2>
              {subtitle && <p className="mt-1 text-xs text-meat-muted">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/40 transition hover:bg-white/[0.07] hover:text-white"
            aria-label="بستن"
          >
            <LuX className="size-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.07] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
