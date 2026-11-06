import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { LuLoaderCircle, LuTriangleAlert, LuX } from 'react-icons/lu'

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'تأیید عملیات',
  description,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  loading = false,
  tone = 'danger',
}) {
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 50)
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, loading, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={() => !loading && onClose?.()}
        aria-label="بستن"
        tabIndex={-1}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative z-10 w-full max-w-sm rounded-2xl border border-white/10 bg-[#1d1d1d] p-6 shadow-2xl animate-fade-up"
      >
        <div className="flex items-start justify-between">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
              tone === 'danger'
                ? 'border border-red-500/25 bg-red-500/10 text-red-300'
                : 'border border-meat-red/25 bg-meat-red/10 text-meat-red'
            }`}
          >
            <LuTriangleAlert className="size-6" />
          </div>
          <button
            type="button"
            onClick={() => !loading && onClose?.()}
            className="rounded-lg p-2 text-white/35 hover:bg-white/5 hover:text-white"
            aria-label="بستن"
          >
            <LuX className="size-4" />
          </button>
        </div>
        <h2 id="confirm-title" className="mt-4 text-lg font-bold text-white">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-meat-muted">{description}</p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => !loading && onClose?.()}
            className="btn-secondary flex-1"
            ref={cancelRef}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 ${
              tone === 'danger'
                ? 'btn bg-red-600 text-white hover:bg-red-500'
                : 'btn-primary'
            }`}
          >
            {loading ? <LuLoaderCircle className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
